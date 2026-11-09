
from __future__ import annotations

import time
from typing import Any, TypedDict

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover
    START = "__start__"
    END = "__end__"

    class _CompiledFallbackGraph:
        def __init__(
            self,
            nodes: dict[str, Any],
            edges: dict[str, str],
            cond_edges: dict[str, Any],
        ) -> None:
            self._nodes = nodes
            self._edges = edges
            self._cond_edges = cond_edges

        async def ainvoke(self, state: dict[str, Any]) -> dict[str, Any]:
            curr_state = dict(state)
            curr_node = self._edges.get(START, END)
            while curr_node != END:
                node_fn = self._nodes[curr_node]
                updates = await node_fn(curr_state)
                if isinstance(updates, dict):
                    curr_state.update(updates)
                if curr_node in self._cond_edges:
                    curr_node = self._cond_edges[curr_node](curr_state)
                else:
                    curr_node = self._edges.get(curr_node, END)
            return curr_state

    class StateGraph:  # type: ignore[no-redef]
        def __init__(self, _state_schema: Any) -> None:
            self._nodes: dict[str, Any] = {}
            self._edges: dict[str, str] = {}
            self._cond_edges: dict[str, Any] = {}

        def add_node(self, node_id: str, action: Any) -> None:
            self._nodes[node_id] = action

        def add_edge(self, start_key: str, end_key: str) -> None:
            self._edges[start_key] = end_key

        def add_conditional_edges(self, source: str, path: Any) -> None:
            self._cond_edges[source] = path

        def compile(self) -> _CompiledFallbackGraph:
            return _CompiledFallbackGraph(self._nodes, self._edges, self._cond_edges)

try:
    from langsmith import traceable
except ImportError:  # pragma: no cover
    def traceable(*_args: Any, **_kwargs: Any) -> Any:
        def _decorator(fn: Any) -> Any:
            return fn
        return _decorator

from services.executor_service import (
    LLMReasonerProtocol,
    MemoryClientProtocol,
    ToolDispatcherProtocol,
    compute_tool_idempotency_key,
    evaluate_condition_expression,
    evaluate_math_expression,
    verify_grounding_citations,
)


class AgentRunState(TypedDict):
    """Typed state dictionary flowing through the dynamically compiled LangGraph StateGraph."""

    run_id: str
    tenant_id: str
    agent_id: str
    step_index: int
    current_node_id: str
    cumulative_spend: float
    inputs: dict[str, Any]
    variables: dict[str, Any]
    memory_context: list[dict[str, Any]]
    memory_degraded: bool
    approval_status: str
    approval_token: str
    pause_requested: bool
    paused_at_node_id: str
    pause_summary: str
    error_message: str
    consecutive_errors: int
    run_status: str
    checkpoints: list[dict[str, Any]]


class DynamicLangGraphEngine:
    """Compiles a canonical AgentIR JSON specification into an executable LangGraph StateGraph."""

    def __init__(
        self,
        llm_reasoner: LLMReasonerProtocol,
        tool_dispatcher: ToolDispatcherProtocol,
        memory_client: MemoryClientProtocol,
    ) -> None:
        self._llm = llm_reasoner
        self._tools = tool_dispatcher
        self._memory = memory_client

    @traceable(run_type="chain", name="deltix_langgraph_run")
    async def execute_or_resume(
        self,
        agent_ir: dict[str, Any],
        run_id: str,
        tenant_id: str,
        inputs: dict[str, Any],
        prior_state: dict[str, Any] | None = None,
        resume_from_node_id: str | None = None,
        approval_status: str = "",
        approval_token: str = "",
    ) -> AgentRunState:
        """Builds the LangGraph StateGraph for agent_ir and executes from entry or resumed node."""
        nodes: list[dict[str, Any]] = agent_ir.get("nodes", [])
        if not nodes:
            raise ValueError("AgentIR must contain at least one node")

        entry_node_id = resume_from_node_id or nodes[0]["id"]
        initial_state = _build_initial_state(
            agent_ir=agent_ir,
            run_id=run_id,
            tenant_id=tenant_id,
            entry_node_id=entry_node_id,
            inputs=inputs,
            prior_state=prior_state,
            approval_status=approval_status,
            approval_token=approval_token,
        )

        compiled_graph = self._compile_state_graph(
            agent_ir=agent_ir,
            entry_node_id=entry_node_id,
        )
        final_state: AgentRunState = await compiled_graph.ainvoke(initial_state)

        if final_state["error_message"]:
            final_state["run_status"] = "FAILED"
        elif final_state["pause_requested"]:
            final_state["run_status"] = "PAUSED_FOR_APPROVAL"
        else:
            final_state["run_status"] = "COMPLETED"

        return final_state

    def _compile_state_graph(
        self,
        agent_ir: dict[str, Any],
        entry_node_id: str,
    ) -> Any:
        workflow = StateGraph(AgentRunState)

        nodes: list[dict[str, Any]] = agent_ir.get("nodes", [])
        transitions: list[dict[str, Any]] = agent_ir.get("transitions", [])
        policies: dict[str, Any] = agent_ir.get("policies", {})
        memory_cfg: dict[str, Any] = agent_ir.get("memory", {})
        limits: dict[str, Any] = agent_ir.get("execution_limits", {})
        capabilities_map: dict[str, dict[str, Any]] = {
            c["capability_id"]: c for c in agent_ir.get("capabilities", [])
        }

        adj: dict[str, list[dict[str, Any]]] = {n["id"]: [] for n in nodes}
        for edge in transitions:
            from_id = edge["from_node"]
            if from_id in adj:
                adj[from_id].append(edge)

        # 1. Register each AgentIR NodeDefinition as an async LangGraph node
        for node_def in nodes:
            node_id = node_def["id"]
            workflow.add_node(
                node_id,
                self._make_node_callable(
                    node_def=node_def,
                    policies=policies,
                    memory_cfg=memory_cfg,
                    capabilities_map=capabilities_map,
                ),
            )

        # 2. Wire START -> entry_node_id (supports resuming mid-graph from a checkpoint!)
        workflow.add_edge(START, entry_node_id)

        # 3. Wire outgoing transitions & conditional routers with pause/error/step-limit guards
        max_steps = int(limits.get("max_steps", 25))
        max_errors = int(limits.get("max_consecutive_errors", 2))

        for node_def in nodes:
            node_id = node_def["id"]
            outgoing = adj.get(node_id, [])

            if not outgoing:
                workflow.add_edge(node_id, END)
                continue

            workflow.add_conditional_edges(
                node_id,
                self._make_edge_router(
                    outgoing_edges=outgoing,
                    max_steps=max_steps,
                    max_errors=max_errors,
                ),
            )

        return workflow.compile()

    def _make_node_callable(
        self,
        node_def: dict[str, Any],
        policies: dict[str, Any],
        memory_cfg: dict[str, Any],
        capabilities_map: dict[str, dict[str, Any]],
    ) -> Any:
        node_id: str = node_def["id"]
        node_type: str = node_def["type"]
        payload: dict[str, Any] = node_def.get("payload", {}) or {}
        output_mapping: dict[str, str] = node_def.get("output_mapping", {}) or {}

        @traceable(run_type="chain", name=f"node_{node_id}_{node_type}")
        async def _run_node(state: AgentRunState) -> dict[str, Any]:
            start_ts = time.perf_counter()
            step_idx = state["step_index"] + 1
            variables = dict(state["variables"])
            checkpoints = list(state["checkpoints"])
            cumulative_spend = float(state["cumulative_spend"])

            node_output: dict[str, Any] = {}
            checkpoint_status = "SUCCEEDED"

            try:
                if node_type == "MEMORY_RETRIEVAL":
                    query = str(
                        state["inputs"].get("query")
                        or state["inputs"].get("resource_id")
                        or node_def.get("description", "context")
                    )
                    namespace = memory_cfg.get(
                        "memory_namespace",
                        f"ns_{state['tenant_id']}_{state['agent_id']}",
                    )
                    top_k = int(memory_cfg.get("max_retrieval_k", 5))
                    memories, degraded = await self._memory.retrieve_memories(
                        tenant_id=state["tenant_id"],
                        agent_id=state["agent_id"],
                        namespace=namespace,
                        query=query,
                        top_k=top_k,
                    )
                    node_output = {"memories_count": len(memories), "degraded": degraded}
                    duration_ms = int((time.perf_counter() - start_ts) * 1000)
                    checkpoints.append(
                        _build_checkpoint_dict(
                            step_index=step_idx,
                            node_id=node_id,
                            node_type=node_type,
                            node_input={"query": query, "namespace": namespace},
                            node_output=node_output,
                            status="SUCCEEDED",
                            duration_ms=duration_ms,
                        )
                    )
                    return {
                        "step_index": step_idx,
                        "current_node_id": node_id,
                        "memory_context": memories,
                        "memory_degraded": degraded,
                        "checkpoints": checkpoints,
                    }

                if node_type == "LLM_REASONING":
                    template = payload.get("prompt_template") or node_def.get(
                        "description", "Analyze the financial request."
                    )
                    temperature = float(payload.get("temperature", 0.0))
                    required_fields: list[str] = list(payload.get("required_fields") or [])
                    min_confidence = float(payload.get("min_confidence", 0.0))
                    require_verbatim_quote = bool(
                        payload.get("require_verbatim_quote", False)
                    )
                    system_prompt = (
                        "You are a DelTix Zero-Hallucination Financial Extraction Node. "
                        "Return ONLY a strict JSON object with extracted parameters, "
                        "confidence (0.0 to 1.0), verbatim_quote, and source_chunk_id. "
                        "Never perform mental arithmetic; extract raw numbers only."
                    )
                    user_prompt = (
                        f"Task: {template}\n"
                        f"Inputs: {state['inputs']}\n"
                        f"Current Variables: {variables}\n"
                        f"Semantic Memory Context: {state['memory_context']}"
                    )
                    llm_result = await self._llm.invoke_reasoning(
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        temperature=temperature,
                    )
                    variables.update(llm_result)
                    _apply_output_mapping(variables, llm_result, output_mapping)

                    if required_fields or min_confidence > 0.0 or require_verbatim_quote:
                        grounding_check = verify_grounding_citations(
                            variables=variables,
                            inputs=state["inputs"],
                            memory_context=state["memory_context"],
                            required_fields=required_fields,
                            min_confidence=min_confidence,
                            require_verbatim_quote=require_verbatim_quote,
                            tolerance_cents=int(payload.get("tolerance_cents", 0)),
                        )
                        variables.update(grounding_check)
                        node_output = {**llm_result, **grounding_check}
                    else:
                        node_output = llm_result

                elif node_type == "DETERMINISTIC_MATH":
                    expression = str(payload.get("expression") or "").strip()
                    target_var = str(
                        payload.get("target_variable") or "amount_usd"
                    ).strip()
                    merged_math_ctx = {**state["inputs"], **variables}
                    computed_val = evaluate_math_expression(expression, merged_math_ctx)
                    math_out = {
                        target_var: computed_val,
                        "math_expression": expression,
                        "deterministic_math_verified": True,
                    }
                    variables.update(math_out)
                    _apply_output_mapping(variables, math_out, output_mapping)
                    node_output = math_out

                elif node_type == "GROUNDING_VERIFIER":
                    required_fields = list(payload.get("required_fields") or [])
                    min_confidence = float(payload.get("min_confidence", 0.95))
                    require_verbatim = bool(payload.get("require_verbatim_quote", True))
                    tolerance_cents = int(payload.get("tolerance_cents", 0))
                    fail_to_human = bool(payload.get("fail_to_human_approval", False))

                    try:
                        verification_out = verify_grounding_citations(
                            variables=variables,
                            inputs=state["inputs"],
                            memory_context=state["memory_context"],
                            required_fields=required_fields,
                            min_confidence=min_confidence,
                            require_verbatim_quote=require_verbatim,
                            tolerance_cents=tolerance_cents,
                        )
                        variables.update(verification_out)
                        _apply_output_mapping(variables, verification_out, output_mapping)
                        node_output = verification_out
                    except ValueError as verify_err:
                        if fail_to_human and state["approval_status"] != "APPROVED":
                            summary = (
                                f"Zero-Hallucination Guardrail escalated to Human Operator: {verify_err}"
                            )
                            duration_ms = int((time.perf_counter() - start_ts) * 1000)
                            checkpoints.append(
                                _build_checkpoint_dict(
                                    step_index=step_idx,
                                    node_id=node_id,
                                    node_type=node_type,
                                    node_input={"variables": variables},
                                    node_output={
                                        "status": "PAUSED_FOR_APPROVAL",
                                        "summary": summary,
                                    },
                                    status="INTERRUPTED",
                                    duration_ms=duration_ms,
                                )
                            )
                            return {
                                "step_index": step_idx,
                                "current_node_id": node_id,
                                "pause_requested": True,
                                "paused_at_node_id": node_id,
                                "pause_summary": summary,
                                "checkpoints": checkpoints,
                            }
                        raise

                elif node_type == "HUMAN_APPROVAL":
                    if state["approval_status"] != "APPROVED":
                        summary = node_def.get(
                            "description",
                            "Human operator approval required before mutating PayPal state.",
                        )
                        duration_ms = int((time.perf_counter() - start_ts) * 1000)
                        checkpoints.append(
                            _build_checkpoint_dict(
                                step_index=step_idx,
                                node_id=node_id,
                                node_type=node_type,
                                node_input={"variables": variables},
                                node_output={"status": "PAUSED_FOR_APPROVAL", "summary": summary},
                                status="INTERRUPTED",
                                duration_ms=duration_ms,
                            )
                        )
                        return {
                            "step_index": step_idx,
                            "current_node_id": node_id,
                            "pause_requested": True,
                            "paused_at_node_id": node_id,
                            "pause_summary": summary,
                            "checkpoints": checkpoints,
                        }

                    # Resumed with APPROVED status -> clear one-time approval_status and continue
                    node_output = {
                        "approval_verified": True,
                        "approval_token_present": bool(state["approval_token"]),
                    }
                    duration_ms = int((time.perf_counter() - start_ts) * 1000)
                    checkpoints.append(
                        _build_checkpoint_dict(
                            step_index=step_idx,
                            node_id=node_id,
                            node_type=node_type,
                            node_input={"approval_status": "APPROVED"},
                            node_output=node_output,
                            status="SUCCEEDED",
                            duration_ms=duration_ms,
                        )
                    )
                    return {
                        "step_index": step_idx,
                        "current_node_id": node_id,
                        "approval_status": "CONSUMED",
                        "pause_requested": False,
                        "paused_at_node_id": "",
                        "checkpoints": checkpoints,
                    }

                elif node_type == "TOOL_EXECUTION":
                    cap_id = payload.get("capability_id", "")
                    operation = str(payload.get("operation", "EXECUTE")).upper()
                    cap_ref = capabilities_map.get(cap_id, {})
                    is_sensitive = bool(cap_ref.get("is_sensitive", False))
                    allowed_actions = [
                        str(a).upper() for a in (cap_ref.get("allowed_actions") or [])
                    ]
                    is_mutation = bool(cap_ref.get("is_mutation", False)) or (
                        is_sensitive
                        or (allowed_actions and "READ" not in allowed_actions)
                        or operation in ("CREATE", "CAPTURE", "REFUND", "MUTATE", "DELETE", "SEND")
                    )
                    read_only_policy = bool(policies.get("read_only", False))
                    max_budget_usd = float(policies.get("max_budget_usd", 0.0))

                    # Deterministic Runtime Guardrail 1: Read-Only Policy Enforcement (Dynamic metadata check)
                    if read_only_policy and is_mutation:
                        raise PermissionError(
                            f"READ_ONLY_POLICY_VIOLATION: cannot execute mutating capability {cap_id}"
                        )

                    # Deterministic Runtime Guardrail 2: Budget Cap Enforcement
                    requested_amount = float(
                        variables.get("amount_usd")
                        or state["inputs"].get("amount_usd")
                        or 0.0
                    )
                    if not read_only_policy and max_budget_usd > 0:
                        if cumulative_spend + requested_amount > max_budget_usd:
                            raise PermissionError(
                                f"BUDGET_CAP_EXCEEDED: cumulative spend {cumulative_spend + requested_amount:.2f} "
                                f"exceeds max_budget_usd {max_budget_usd:.2f}"
                            )

                    # Deterministic Runtime Guardrail 3: Sensitive Tool Requires Approval Token
                    if is_sensitive and not state["approval_token"]:
                        raise PermissionError(
                            f"MISSING_APPROVAL_TOKEN: sensitive capability {cap_id} requires a verified approval token"
                        )

                    tool_params = {**state["inputs"], **variables}
                    idempotency_key = compute_tool_idempotency_key(
                        tenant_id=state["tenant_id"],
                        run_id=state["run_id"],
                        step_index=step_idx,
                        capability_id=cap_id,
                        operation=operation,
                        parameters=tool_params,
                    )
                    tool_result = await self._tools.dispatch_tool(
                        run_id=state["run_id"],
                        tenant_id=state["tenant_id"],
                        step_index=step_idx,
                        capability_id=cap_id,
                        operation=operation,
                        parameters=tool_params,
                        approval_token=state["approval_token"] or None,
                    )
                    tool_result_with_idem = {
                        **tool_result,
                        "idempotency_key": idempotency_key,
                    }
                    cumulative_spend += requested_amount
                    variables.update(tool_result_with_idem)
                    _apply_output_mapping(variables, tool_result_with_idem, output_mapping)
                    node_output = tool_result_with_idem

                elif node_type == "MEMORY_UPDATE":
                    namespace = memory_cfg.get(
                        "memory_namespace",
                        f"ns_{state['tenant_id']}_{state['agent_id']}",
                    )
                    summary_text = str(
                        variables.get("reasoning_summary")
                        or variables.get("status")
                        or f"Completed run {state['run_id']}"
                    )
                    stored = await self._memory.store_memory(
                        tenant_id=state["tenant_id"],
                        agent_id=state["agent_id"],
                        namespace=namespace,
                        content=summary_text,
                        metadata={"run_id": state["run_id"]},
                    )
                    node_output = {"memory_stored": stored}

                elif node_type in ("CONDITIONAL_ROUTER", "DETERMINISTIC_PROCESS"):
                    expr = str(payload.get("expression") or "").strip()
                    static_out = payload.get("static_output") or {}
                    if expr:
                        target_var = str(
                            payload.get("target_variable") or "computed_value"
                        ).strip()
                        merged_ctx = {**state["inputs"], **variables}
                        computed_val = evaluate_math_expression(expr, merged_ctx)
                        proc_out = {
                            target_var: computed_val,
                            "deterministic_math_verified": True,
                        }
                        variables.update(proc_out)
                        _apply_output_mapping(variables, proc_out, output_mapping)
                        node_output = proc_out
                    elif isinstance(static_out, dict) and static_out:
                        variables.update(static_out)
                        node_output = dict(static_out)
                    else:
                        node_output = {"node_id": node_id, "status": "ok"}

                duration_ms = int((time.perf_counter() - start_ts) * 1000)
                checkpoints.append(
                    _build_checkpoint_dict(
                        step_index=step_idx,
                        node_id=node_id,
                        node_type=node_type,
                        node_input={"inputs": state["inputs"]},
                        node_output=node_output,
                        status=checkpoint_status,
                        duration_ms=duration_ms,
                    )
                )
                return {
                    "step_index": step_idx,
                    "current_node_id": node_id,
                    "cumulative_spend": cumulative_spend,
                    "variables": variables,
                    "consecutive_errors": 0,
                    "checkpoints": checkpoints,
                }

            except Exception as exc:  # noqa: BLE001
                duration_ms = int((time.perf_counter() - start_ts) * 1000)
                checkpoints.append(
                    _build_checkpoint_dict(
                        step_index=step_idx,
                        node_id=node_id,
                        node_type=node_type,
                        node_input={"inputs": state["inputs"]},
                        node_output={"error": str(exc)},
                        status="FAILED",
                        duration_ms=duration_ms,
                    )
                )
                return {
                    "step_index": step_idx,
                    "current_node_id": node_id,
                    "error_message": str(exc),
                    "consecutive_errors": state["consecutive_errors"] + 1,
                    "checkpoints": checkpoints,
                }

        return _run_node

    def _make_edge_router(
        self,
        outgoing_edges: list[dict[str, Any]],
        max_steps: int,
        max_errors: int,
    ) -> Callable[[AgentRunState], str]:
        def _route(state: AgentRunState) -> str:
            # 1. Halt immediately to END if HUMAN_APPROVAL requested a non-blocking pause
            if state["pause_requested"]:
                return END

            # 2. Halt immediately if an error occurred or step limit was reached
            if state["error_message"] or state["consecutive_errors"] >= max_errors:
                return END

            if state["step_index"] >= max_steps:
                return END

            # 3. Evaluate conditional edges before falling back to the default edge
            merged_context = {**state["inputs"], **state["variables"]}
            default_target: str | None = None

            for edge in outgoing_edges:
                if edge.get("is_default"):
                    default_target = edge["to_node"]
                cond = (edge.get("condition_expression") or "").strip()
                if cond and evaluate_condition_expression(cond, merged_context):
                    return edge["to_node"]

            if default_target:
                return default_target

            return outgoing_edges[0]["to_node"]

        return _route


def _apply_output_mapping(
    variables: dict[str, Any],
    source_output: dict[str, Any],
    output_mapping: dict[str, str],
) -> None:
    for target_key, source_key in output_mapping.items():
        if source_key in source_output:
            variables[target_key] = source_output[source_key]


def _build_checkpoint_dict(
    step_index: int,
    node_id: str,
    node_type: str,
    node_input: dict[str, Any],
    node_output: dict[str, Any],
    status: str,
    duration_ms: int,
) -> dict[str, Any]:
    return {
        "step_index": step_index,
        "node_id": node_id,
        "node_type": node_type,
        "node_input": node_input,
        "node_output": node_output,
        "status": status,
        "duration_ms": max(0, duration_ms),
    }


def _build_initial_state(
    agent_ir: dict[str, Any],
    run_id: str,
    tenant_id: str,
    entry_node_id: str,
    inputs: dict[str, Any],
    prior_state: dict[str, Any] | None,
    approval_status: str,
    approval_token: str,
) -> AgentRunState:
    prior = prior_state or {}
    return {
        "run_id": run_id,
        "tenant_id": tenant_id,
        "agent_id": agent_ir.get("agent_id", "agt_unknown"),
        "step_index": int(prior.get("step_index", 0)),
        "current_node_id": entry_node_id,
        "cumulative_spend": float(prior.get("cumulative_spend", 0.0)),
        "inputs": dict(prior.get("inputs") or inputs),
        "variables": dict(prior.get("variables") or {}),
        "memory_context": list(prior.get("memory_context") or []),
        "memory_degraded": bool(prior.get("memory_degraded", False)),
        "approval_status": approval_status,
        "approval_token": approval_token,
        "pause_requested": False,
        "paused_at_node_id": "",
        "pause_summary": "",
        "error_message": "",
        "consecutive_errors": 0,
        "run_status": "RUNNING",
        "checkpoints": [],
    }
