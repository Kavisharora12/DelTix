"""Node execution services, LangChain Gemini sliding-window cascade, and safe AST router."""

from __future__ import annotations

import ast
from collections import deque
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import operator
import re
import threading
import time
from typing import Any, Callable, Protocol

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

try:
    from langchain_core.messages import HumanMessage, SystemMessage
except ImportError:  # pragma: no cover
    class SystemMessage:  # type: ignore[no-redef]
        def __init__(self, content: str) -> None:
            self.content = content

    class HumanMessage:  # type: ignore[no-redef]
        def __init__(self, content: str) -> None:
            self.content = content

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover
    ChatGoogleGenerativeAI = None  # type: ignore[assignment,misc]

try:
    from paypal_agent_toolkit.langchain.toolkit import PayPalToolkit
    from paypal_agent_toolkit.shared.configuration import Configuration, Context
except ImportError:  # pragma: no cover
    try:
        from paypal_agent_toolkit.shared.api import PayPalAPI
        from paypal_agent_toolkit.shared.configuration import Configuration, Context, is_tool_allowed
        from paypal_agent_toolkit.shared.tools import tools as _pp_tools

        class _SharedPayPalTool:
            def __init__(self, tool_def: dict[str, Any], paypal_api: Any) -> None:
                self.name = tool_def["method"]
                self.description = tool_def.get("description", "")
                self.args_schema = tool_def.get("args_schema")
                self._api = paypal_api

            def invoke(self, params: dict[str, Any]) -> str:
                return self._api.run(self.name, params)

        class PayPalToolkit:  # type: ignore[no-redef]
            """Compatibility wrapper over paypal_agent_toolkit.shared when legacy langchain.tools is absent."""

            def __init__(self, client_id: str, secret: str, configuration: Any) -> None:
                self.configuration = configuration
                self._paypal_api = PayPalAPI(
                    client_id=client_id, secret=secret, context=configuration.context
                )
                self._tools = [
                    _SharedPayPalTool(tool_def, self._paypal_api)
                    for tool_def in _pp_tools
                    if is_tool_allowed(tool_def, configuration)
                ]

            def get_tools(self) -> list[_SharedPayPalTool]:
                return self._tools
    except ImportError:
        PayPalToolkit = None  # type: ignore[assignment,misc]
        Configuration = None  # type: ignore[assignment,misc]
        Context = None  # type: ignore[assignment,misc]

try:
    from langsmith import traceable
except ImportError:  # pragma: no cover
    def traceable(*_args: Any, **_kwargs: Any) -> Callable[[Any], Any]:
        def _decorator(fn: Any) -> Any:
            return fn
        return _decorator

from config.config import DEFAULT_GEMINI_MODELS


class LLMReasonerProtocol(Protocol):
    """Protocol for executing LLM_REASONING nodes via LangChain Gemini models."""

    async def invoke_reasoning(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        """Executes structured reasoning and returns a parsed dictionary."""


class ToolDispatcherProtocol(Protocol):
    """Protocol for dispatching PayPal tool executions to Capability & Policy Service (:8084)."""

    async def dispatch_tool(
        self,
        run_id: str,
        tenant_id: str,
        step_index: int,
        capability_id: str,
        operation: str,
        parameters: dict[str, Any],
        approval_token: str | None = None,
    ) -> dict[str, Any]:
        """Dispatches a verified tool call and returns the provider output."""


class MemoryClientProtocol(Protocol):
    """Protocol for querying and updating Mem0 semantic memory (:8083)."""

    async def retrieve_memories(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        query: str,
        top_k: int = 5,
    ) -> tuple[list[dict[str, Any]], bool]:
        """Returns (memories, memory_degraded)."""

    async def store_memory(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        content: str,
        metadata: dict[str, Any],
    ) -> bool:
        """Persists a sanitized memory summary."""


class SlidingWindowRateLimiter:
    """Thread-safe per-model sliding-window rate limiter."""

    def __init__(self, max_requests: int = 15, window_seconds: float = 60.0) -> None:
        self._max_requests = max(1, max_requests)
        self._window_seconds = max(1.0, window_seconds)
        self._lock = threading.Lock()
        self._history: dict[str, deque[float]] = {}

    def allow(self, model_name: str, now: float | None = None) -> bool:
        """Returns True if model_name is within its sliding-window quota and records the timestamp."""
        current_time = now if now is not None else time.monotonic()
        cutoff = current_time - self._window_seconds

        with self._lock:
            bucket = self._history.setdefault(model_name, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self._max_requests:
                return False

            bucket.append(current_time)
            return True


class LangChainGeminiCascade(LLMReasonerProtocol):
    """Executes LangChain ChatGoogleGenerativeAI across all Gemini models with a sliding-window limiter."""

    def __init__(
        self,
        api_key: str,
        models: list[str] | None = None,
        rpm_per_model: int = 15,
        window_seconds: float = 60.0,
        model_factory: Callable[[str, float], Any] | None = None,
    ) -> None:
        self._api_key = api_key
        self._models = models or list(DEFAULT_GEMINI_MODELS)
        self._limiter = SlidingWindowRateLimiter(
            max_requests=rpm_per_model,
            window_seconds=window_seconds,
        )
        self._model_factory = model_factory

    def _build_chat_model(self, model_name: str, temperature: float) -> Any:
        if self._model_factory is not None:
            return self._model_factory(model_name, temperature)
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=self._api_key,
            temperature=temperature,
        )

    @traceable(run_type="llm", name="deltix_gemini_cascade")
    async def invoke_reasoning(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        """Tries each Gemini model in order, skipping models that hit their sliding-window limit or 429."""
        errors: list[str] = []
        combined_prompt = f"{system_prompt}\n\n{user_prompt}".strip() if system_prompt else user_prompt
        messages = [HumanMessage(content=combined_prompt)]

        for model_name in self._models:
            if not self._limiter.allow(model_name):
                errors.append(f"{model_name}: sliding_window_limit_reached")
                continue

            try:
                chat_model = self._build_chat_model(model_name, temperature)
                response = await chat_model.ainvoke(messages)
                raw_content = (
                    response.content
                    if hasattr(response, "content")
                    else str(response)
                )
                return _parse_json_or_text_response(raw_content, model_name)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{model_name}: {exc}")
                continue

        raise RuntimeError(f"All Gemini models failed: {'; '.join(errors)}")


def _parse_json_or_text_response(raw_content: Any, model_name: str) -> dict[str, Any]:
    if isinstance(raw_content, dict):
        return {**raw_content, "_model_used": model_name}

    text = str(raw_content).strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            parsed["_model_used"] = model_name
            return parsed
    except json.JSONDecodeError:
        pass

    return {"reasoning_summary": text, "_model_used": model_name}


def compute_tool_idempotency_key(
    tenant_id: str,
    run_id: str,
    step_index: int,
    capability_id: str,
    operation: str,
    parameters: dict[str, Any],
) -> str:
    """Computes a deterministic SHA-256 idempotency key for horizontal worker retry safety."""
    canonical_params = json.dumps(parameters, sort_keys=True, default=str)
    raw = f"{tenant_id}:{run_id}:{step_index}:{capability_id}:{operation}:{canonical_params}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"idem_{digest}"


class HTTPToolDispatcher(ToolDispatcherProtocol):
    """HTTP client for Capability & Policy Service (:8084)."""

    def __init__(self, base_url: str, timeout_seconds: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    @traceable(run_type="tool", name="deltix_capability_dispatch")
    async def dispatch_tool(
        self,
        run_id: str,
        tenant_id: str,
        step_index: int,
        capability_id: str,
        operation: str,
        parameters: dict[str, Any],
        approval_token: str | None = None,
    ) -> dict[str, Any]:
        """Calls POST /internal/v1/tools/dispatch on Capability & Policy Service (:8084)."""
        idempotency_key = compute_tool_idempotency_key(
            tenant_id=tenant_id,
            run_id=run_id,
            step_index=step_index,
            capability_id=capability_id,
            operation=operation,
            parameters=parameters,
        )
        payload = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "step_index": step_index,
            "capability_id": capability_id,
            "operation": operation,
            "parameters": parameters,
            "approval_token": approval_token or "",
            "idempotency_key": idempotency_key,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._base_url}/internal/v1/tools/dispatch",
                json=payload,
                headers={
                    "X-Tenant-ID": tenant_id,
                    "X-Idempotency-Key": idempotency_key,
                    "PayPal-Request-Id": idempotency_key,
                },
            )
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"capability dispatch HTTP {resp.status_code}: {resp.text}"
                )
            return resp.json()


def build_paypal_toolkit_actions(
    capability_id: str,
    read_only: bool = False,
) -> tuple[str, str, dict[str, dict[str, bool]]]:
    """Maps a capability_id (e.g. 'paypal.orders.create', 'paypal.invoices.list') to PayPal Agent Toolkit Configuration.actions."""
    cleaned = capability_id.strip()
    if cleaned.startswith("paypal."):
        cleaned = cleaned[len("paypal.") :]

    parts = [p for p in re.split(r"[._-]+", cleaned) if p]
    if len(parts) < 2:
        raise ValueError(
            f"INVALID_PAYPAL_CAPABILITY: '{capability_id}' must specify resource and action (e.g. 'paypal.orders.create')"
        )

    # Support both 'orders.create' and 'create_order' conventions
    known_verbs = {
        "create",
        "get",
        "list",
        "capture",
        "pay",
        "refund",
        "send",
        "cancel",
        "delete",
        "accept",
        "update",
        "recordpayment",
        "recordrefund",
        "sendreminder",
        "generateqrc",
    }
    if parts[0].lower() in known_verbs and len(parts) >= 2:
        action = parts[0]
        resource = "_".join(parts[1:])
        if not resource.endswith("s") and resource not in ("shipment_tracking",):
            resource = resource + "s"
    else:
        resource = "_".join(parts[:-1])
        action = parts[-1]

    resource_aliases = {
        "invoice": "invoices",
        "order": "orders",
        "product": "products",
        "subscription": "subscriptions",
        "subscription_plan": "subscriptionPlans",
        "subscription_plans": "subscriptionPlans",
        "subscriptionplan": "subscriptionPlans",
        "subscriptionplans": "subscriptionPlans",
    }
    action_aliases = {
        "sendreminder": "sendReminder",
        "send_reminder": "sendReminder",
        "generateqrc": "generateQRC",
        "generate_qrc": "generateQRC",
    }
    resource = resource_aliases.get(resource.lower(), resource)
    action = action_aliases.get(action.lower(), action)

    # Normalize common PayPal Agent Toolkit action aliases
    if resource == "captures" and action == "refund":
        resource = "orders"
    if read_only and action.lower() not in ("get", "list", "show", "search"):
        raise PermissionError(
            f"READ_ONLY_POLICY_VIOLATION: cannot enable mutating PayPal Toolkit action '{resource}.{action}'"
        )

    actions_dict = {resource: {action: True}}
    return resource, action, actions_dict


def normalize_paypal_toolkit_input(
    resource: str,
    action: str,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    """Maps flat DelTix workflow inputs into PayPal Agent Toolkit structured payloads when omitted."""
    out = dict(parameters)
    raw_amount = out.get("amount_usd") if out.get("amount_usd") is not None else out.get("amount")
    try:
        amount = round(float(raw_amount), 2) if raw_amount is not None else 0.0
    except (TypeError, ValueError):
        amount = 0.0

    item_name = str(
        out.get("description")
        or out.get("invoice_id")
        or out.get("item_name")
        or "DelTix Service"
    )

    if resource == "orders" and action == "create":
        if not out.get("currency_code"):
            out["currency_code"] = "USD"
        if not out.get("items") and amount > 0:
            out["items"] = [
                {
                    "name": item_name,
                    "quantity": 1,
                    "item_cost": amount,
                    "item_total": amount,
                }
            ]
    elif resource == "invoices" and action == "create":
        currency = str(out.get("currency_code") or out.get("currency") or "USD").upper()
        if not out.get("detail"):
            out["detail"] = {"currency_code": currency}
        email = out.get("recipient_email") or out.get("customer_email")
        if not out.get("primary_recipients") and email:
            out["primary_recipients"] = [{"billing_info": {"email_address": str(email)}}]
        if not out.get("items") and amount > 0:
            out["items"] = [
                {
                    "name": item_name,
                    "quantity": "1",
                    "unit_amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}",
                    },
                }
            ]
    return out


class PayPalAgentToolkitDispatcher(ToolDispatcherProtocol):
    """Executes PayPal tools via the official paypal-agent-toolkit LangChain integration with least-privilege Configuration."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        sandbox: bool = True,
        fallback_http_dispatcher: ToolDispatcherProtocol | None = None,
        toolkit_factory: Callable[[str, str, bool, dict[str, dict[str, bool]]], Any] | None = None,
    ) -> None:
        self._client_id = client_id.strip()
        self._client_secret = client_secret.strip()
        self._sandbox = sandbox
        self._fallback = fallback_http_dispatcher
        self._toolkit_factory = toolkit_factory

    def _create_toolkit(self, actions_dict: dict[str, dict[str, bool]]) -> Any:
        if self._toolkit_factory is not None:
            return self._toolkit_factory(
                self._client_id, self._client_secret, self._sandbox, actions_dict
            )
        if not self._client_id or not self._client_secret:
            raise RuntimeError(
                "PAYPAL_CREDENTIALS_MISSING: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env"
            )
        if PayPalToolkit is None:
            raise RuntimeError(
                "PAYPAL_TOOLKIT_NOT_INSTALLED: run 'pip install paypal-agent-toolkit'"
            )
        if Configuration is not None and Context is not None:
            cfg = Configuration(
                context=Context(sandbox=self._sandbox),
                actions=actions_dict,
            )
            return PayPalToolkit(
                client_id=self._client_id,
                secret=self._client_secret,
                configuration=cfg,
            )
        return PayPalToolkit(
            client_id=self._client_id,
            client_secret=self._client_secret,
            sandbox=self._sandbox,
        )

    @traceable(run_type="tool", name="deltix_paypal_agent_toolkit")
    async def dispatch_tool(
        self,
        run_id: str,
        tenant_id: str,
        step_index: int,
        capability_id: str,
        operation: str,
        parameters: dict[str, Any],
        approval_token: str | None = None,
    ) -> dict[str, Any]:
        """Executes a scoped tool from PayPalToolkit.get_tools() and returns structured output."""
        idempotency_key = compute_tool_idempotency_key(
            tenant_id=tenant_id,
            run_id=run_id,
            step_index=step_index,
            capability_id=capability_id,
            operation=operation,
            parameters=parameters,
        )
        resource, action, actions_dict = build_paypal_toolkit_actions(capability_id)
        toolkit = self._create_toolkit(actions_dict)
        tools = list(toolkit.get_tools() or [])
        if not tools:
            if self._fallback is not None:
                return await self._fallback.dispatch_tool(
                    run_id=run_id,
                    tenant_id=tenant_id,
                    step_index=step_index,
                    capability_id=capability_id,
                    operation=operation,
                    parameters=parameters,
                    approval_token=approval_token,
                )
            raise RuntimeError(
                f"PAYPAL_TOOLKIT_EMPTY: no LangChain tools returned for actions={actions_dict}"
            )

        selected_tool = _match_paypal_langchain_tool(tools, capability_id, resource, action)
        tool_input = {
            k: v
            for k, v in parameters.items()
            if not str(k).startswith("_")
        }
        tool_input = normalize_paypal_toolkit_input(resource, action, tool_input)
        args_schema = getattr(selected_tool, "args_schema", None)
        schema_fields = getattr(args_schema, "model_fields", None) or getattr(args_schema, "__fields__", None)
        if isinstance(schema_fields, dict) and schema_fields:
            tool_input = {k: v for k, v in tool_input.items() if k in schema_fields}

        if hasattr(selected_tool, "ainvoke"):
            raw_res = await selected_tool.ainvoke(tool_input)
        elif hasattr(selected_tool, "invoke"):
            raw_res = selected_tool.invoke(tool_input)
        elif callable(selected_tool):
            raw_res = selected_tool(**tool_input)
        else:
            raise RuntimeError(f"Selected PayPal tool '{selected_tool}' is not invokable")

        parsed = _parse_json_or_text_response(raw_res, getattr(selected_tool, "name", capability_id))
        parsed["capability_id"] = capability_id
        parsed["idempotency_key"] = idempotency_key
        parsed["toolkit"] = "paypal-agent-toolkit"
        parsed["sandbox"] = self._sandbox
        return parsed


def _match_paypal_langchain_tool(
    tools: list[Any],
    capability_id: str,
    resource: str,
    action: str,
) -> Any:
    """Matches a LangChain BaseTool from PayPalToolkit.get_tools() by name/resource/action."""
    if len(tools) == 1:
        return tools[0]

    singular_resource = resource[:-1] if resource.endswith("s") else resource
    candidates = (
        capability_id.lower(),
        f"{action}_{singular_resource}".lower(),
        f"{action}_{resource}".lower(),
        f"{resource}_{action}".lower(),
        action.lower(),
    )
    for t in tools:
        t_name = str(getattr(t, "name", "")).lower()
        if any(c in t_name or t_name in c for c in candidates):
            return t
    return tools[0]


class HTTPMemoryClient(MemoryClientProtocol):
    """HTTP client for Mem0 Memory Service (:8083) with graceful degradation."""

    def __init__(self, base_url: str, timeout_seconds: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    @traceable(run_type="retriever", name="deltix_mem0_retrieve")
    async def retrieve_memories(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        query: str,
        top_k: int = 5,
    ) -> tuple[list[dict[str, Any]], bool]:
        """Retrieves scoped semantic memories; degrades gracefully (degraded=True) if unreachable."""
        try:
            bounded_limit = max(1, min(100, int(top_k)))
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/internal/v1/memory/retrieve",
                    headers={"X-Tenant-ID": tenant_id},
                    json={
                        "tenant_id": tenant_id,
                        "agent_id": agent_id,
                        "query": query,
                        "limit": bounded_limit,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("memories", []), False
        except Exception:  # noqa: BLE001
            # Graceful degradation per architecture spec: never fail a payment run if memory is unreachable
            return [], True

    @traceable(run_type="chain", name="deltix_mem0_store")
    async def store_memory(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        content: str,
        metadata: dict[str, Any],
    ) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/internal/v1/memory/store",
                    headers={"X-Tenant-ID": tenant_id},
                    json={
                        "tenant_id": tenant_id,
                        "agent_id": agent_id,
                        "messages": [{"role": "assistant", "content": content}],
                    },
                )
                return resp.status_code < 300
        except Exception:  # noqa: BLE001
            return False


_SAFE_COMPARE_OPS: dict[type[ast.cmpop], Callable[[Any, Any], bool]] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
}


def evaluate_condition_expression(expression: str, context_vars: dict[str, Any]) -> bool:
    """Safely evaluates a deterministic routing condition using AST inspection (never eval())."""
    expr = expression.strip()
    if not expr:
        return True

    try:
        tree = ast.parse(expr, mode="eval")
        return bool(_eval_ast_node(tree.body, context_vars))
    except Exception:  # noqa: BLE001
        return False


def _eval_ast_node(node: ast.AST, context_vars: dict[str, Any]) -> Any:
    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, ast.Name):
        if node.id in ("true", "True"):
            return True
        if node.id in ("false", "False"):
            return False
        return context_vars.get(node.id)

    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return not bool(_eval_ast_node(node.operand, context_vars))

    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -float(_eval_ast_node(node.operand, context_vars))

    if isinstance(node, ast.BoolOp):
        values = [_eval_ast_node(v, context_vars) for v in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        if isinstance(node.op, ast.Or):
            return any(values)

    if isinstance(node, ast.Compare):
        left = _eval_ast_node(node.left, context_vars)
        for op, comparator in zip(node.ops, node.comparators):
            right = _eval_ast_node(comparator, context_vars)
            op_fn = _SAFE_COMPARE_OPS.get(type(op))
            if op_fn is None or not op_fn(left, right):
                return False
            left = right
        return True

    raise ValueError(f"Unsupported AST node in condition expression: {type(node).__name__}")


_SAFE_MATH_BIN_OPS: dict[type[ast.operator], Callable[[Decimal, Decimal], Decimal]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
}


def _to_decimal(val: Any) -> Decimal:
    if isinstance(val, Decimal):
        return val
    if isinstance(val, bool) or val is None:
        raise ValueError(f"Cannot convert {val!r} to Decimal financial amount")
    return Decimal(str(val))


def evaluate_math_expression(
    expression: str,
    context_vars: dict[str, Any],
    quantize_cents: bool = True,
) -> float:
    """Executes deterministic financial arithmetic using Decimal AST evaluation (zero LLM math hallucination)."""
    expr = expression.strip()
    if not expr:
        raise ValueError("DETERMINISTIC_MATH_ERROR: expression must not be empty")

    tree = ast.parse(expr, mode="eval")
    result_dec = _eval_math_ast_node(tree.body, context_vars)
    if quantize_cents:
        result_dec = result_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(result_dec)


def _eval_math_ast_node(node: ast.AST, context_vars: dict[str, Any]) -> Decimal:
    if isinstance(node, ast.Constant):
        return _to_decimal(node.value)

    if isinstance(node, ast.Name):
        if node.id not in context_vars:
            raise ValueError(f"DETERMINISTIC_MATH_ERROR: undefined variable '{node.id}'")
        return _to_decimal(context_vars[node.id])

    if isinstance(node, ast.UnaryOp):
        operand = _eval_math_ast_node(node.operand, context_vars)
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return operand

    if isinstance(node, ast.BinOp):
        op_fn = _SAFE_MATH_BIN_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError(f"DETERMINISTIC_MATH_ERROR: unsupported operator {type(node.op).__name__}")
        left = _eval_math_ast_node(node.left, context_vars)
        right = _eval_math_ast_node(node.right, context_vars)
        return op_fn(left, right)

    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fn_name = node.func.id
        args = [_eval_math_ast_node(arg, context_vars) for arg in node.args]
        if fn_name == "min" and args:
            return min(args)
        if fn_name == "max" and args:
            return max(args)
        if fn_name == "abs" and len(args) == 1:
            return abs(args[0])
        if fn_name == "sum" and args:
            return sum(args, Decimal("0.00"))
        if fn_name == "round" and len(args) == 1:
            return args[0].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    raise ValueError(f"DETERMINISTIC_MATH_ERROR: unsupported AST node {type(node).__name__}")


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def verify_grounding_citations(
    variables: dict[str, Any],
    inputs: dict[str, Any],
    memory_context: list[dict[str, Any]],
    required_fields: list[str] | None = None,
    min_confidence: float = 0.0,
    require_verbatim_quote: bool = False,
    tolerance_cents: int = 0,
) -> dict[str, Any]:
    """Verifies LLM extractions against retrieved RAG/Mem0 chunks and inputs to prevent hallucinations."""
    merged = {**inputs, **variables}

    # 1. Check required schema fields
    for field in required_fields or []:
        if field not in merged or merged[field] is None or merged[field] == "":
            raise ValueError(
                f"GROUNDING_VERIFICATION_FAILED: missing required extracted field '{field}'"
            )

    # 2. Check confidence score bound if configured or if confidence is present
    if min_confidence > 0.0:
        confidence = float(merged.get("confidence", 0.0))
        if confidence < min_confidence:
            raise ValueError(
                f"LOW_CONFIDENCE_DETECTED: extraction confidence {confidence:.2f} is below minimum threshold {min_confidence:.2f}"
            )

    # 3. Verbatim Quote & Source Chunk Grounding Check
    verbatim_quote = str(merged.get("verbatim_quote") or "").strip()
    source_chunk_id = str(merged.get("source_chunk_id") or "").strip()

    if require_verbatim_quote or verbatim_quote or source_chunk_id:
        if require_verbatim_quote and not verbatim_quote:
            raise ValueError(
                "GROUNDING_VERIFICATION_FAILED: verbatim_quote is required for zero-hallucination verification"
            )

        # Build corpus of all retrieved chunks + input documents
        chunk_map: dict[str, str] = {}
        all_corpus_texts: list[str] = []

        for idx, item in enumerate(memory_context):
            cid = str(item.get("chunk_id") or item.get("id") or f"chunk_{idx}")
            text = str(
                item.get("content")
                or item.get("memory")
                or item.get("text")
                or json.dumps(item)
            )
            chunk_map[cid] = text
            all_corpus_texts.append(text)

        for key, val in inputs.items():
            if isinstance(val, str) and val.strip():
                all_corpus_texts.append(val)
                chunk_map[f"input_{key}"] = val

        if source_chunk_id:
            if source_chunk_id not in chunk_map:
                raise ValueError(
                    f"GROUNDING_VERIFICATION_FAILED: fabricated source_chunk_id '{source_chunk_id}' not found in retrieved context"
                )
            target_corpus = chunk_map[source_chunk_id]
        else:
            target_corpus = " ".join(all_corpus_texts)

        if verbatim_quote:
            norm_quote = _normalize_whitespace(verbatim_quote)
            norm_corpus = _normalize_whitespace(target_corpus)
            if norm_quote not in norm_corpus:
                raise ValueError(
                    f"GROUNDING_VERIFICATION_FAILED: verbatim_quote '{verbatim_quote}' does not exist in source context"
                )

    # 4. Numeric Reconciliation Tolerance Check (e.g., extracted amount_usd vs expected_amount_usd)
    if (
        "amount_usd" in merged
        and "expected_amount_usd" in merged
        and merged["amount_usd"] is not None
        and merged["expected_amount_usd"] is not None
    ):
        actual_cents = int(
            (_to_decimal(merged["amount_usd"]) * 100).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        expected_cents = int(
            (_to_decimal(merged["expected_amount_usd"]) * 100).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        diff_cents = abs(actual_cents - expected_cents)
        if diff_cents > max(0, tolerance_cents):
            raise ValueError(
                f"GROUNDING_MATH_MISMATCH: amount_usd ({actual_cents / 100:.2f}) differs from expected_amount_usd "
                f"({expected_cents / 100:.2f}) by {diff_cents} cents (tolerance={tolerance_cents} cents)"
            )

    return {
        "grounding_verified": True,
        "verified_chunk_id": source_chunk_id or "inputs",
    }
