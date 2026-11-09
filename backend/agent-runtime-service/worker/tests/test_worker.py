"""Unit tests for the DelTix Python LangGraph Runtime Worker."""

from __future__ import annotations

import os
import sys
from typing import Any
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.state_graph import DynamicLangGraphEngine  # noqa: E402
from services.executor_service import (  # noqa: E402
    LangChainGeminiCascade,
    PayPalAgentToolkitDispatcher,
    build_paypal_toolkit_actions,
    compute_tool_idempotency_key,
    evaluate_condition_expression,
    evaluate_math_expression,
    verify_grounding_citations,
)


class FakeLLMReasoner:
    """Test double for LLMReasonerProtocol."""

    async def invoke_reasoning(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        return {
            "reasoning_summary": "Verified damaged item claim; eligible for refund.",
            "amount_usd": 45.0,
        }


class FakeToolDispatcher:
    """Test double for ToolDispatcherProtocol."""

    def __init__(self) -> None:
        self.dispatched_calls: list[dict[str, Any]] = []

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
        self.dispatched_calls.append(
            {
                "run_id": run_id,
                "capability_id": capability_id,
                "approval_token": approval_token,
                "parameters": parameters,
            }
        )
        return {
            "paypal_refund_id": "REFUND_SANDBOX_991",
            "status": "COMPLETED",
        }


class FakeMemoryClient:
    """Test double for MemoryClientProtocol."""

    def __init__(self) -> None:
        self.stored: list[str] = []

    async def retrieve_memories(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        query: str,
        top_k: int = 5,
    ) -> tuple[list[dict[str, Any]], bool]:
        return [{"memory": "Customer has zero prior refund disputes."}], False

    async def store_memory(
        self,
        tenant_id: str,
        agent_id: str,
        namespace: str,
        content: str,
        metadata: dict[str, Any],
    ) -> bool:
        self.stored.append(content)
        return True


def _sample_refund_agent_ir(max_budget_usd: float = 75.0) -> dict[str, Any]:
    return {
        "ir_version": "1.0.0",
        "agent_id": "agt_refund_01",
        "tenant_id": "ten_paypal_01",
        "capabilities": [
            {
                "capability_id": "paypal.captures.refund",
                "version": "1.0.0",
                "is_sensitive": True,
                "allowed_actions": ["EXECUTE"],
            }
        ],
        "policies": {
            "read_only": False,
            "max_budget_usd": max_budget_usd,
            "require_human_approval": True,
        },
        "memory": {
            "enable_semantic_memory": True,
            "memory_namespace": "ns_ten_paypal_01_agt_refund_01",
            "max_retrieval_k": 5,
        },
        "execution_limits": {
            "max_steps": 15,
            "timeout_seconds": 60,
            "max_loop_iterations": 1,
            "max_consecutive_errors": 2,
        },
        "nodes": [
            {
                "id": "node_memory_retrieve",
                "type": "MEMORY_RETRIEVAL",
                "description": "Retrieve customer history",
            },
            {
                "id": "node_llm_reason",
                "type": "LLM_REASONING",
                "description": "Analyze refund request",
                "payload": {"prompt_template": "Check refund eligibility", "temperature": 0.0},
            },
            {
                "id": "node_human_approval",
                "type": "HUMAN_APPROVAL",
                "description": "Await operator approval before refunding capture",
            },
            {
                "id": "node_paypal_tool",
                "type": "TOOL_EXECUTION",
                "description": "Execute PayPal capture refund",
                "payload": {
                    "capability_id": "paypal.captures.refund",
                    "operation": "EXECUTE",
                },
            },
            {
                "id": "node_memory_update",
                "type": "MEMORY_UPDATE",
                "description": "Store refund outcome in Mem0",
            },
            {
                "id": "node_terminal",
                "type": "DETERMINISTIC_PROCESS",
                "description": "Terminal sink",
            },
        ],
        "transitions": [
            {"from_node": "node_memory_retrieve", "to_node": "node_llm_reason", "is_default": True},
            {"from_node": "node_llm_reason", "to_node": "node_human_approval", "is_default": True},
            {"from_node": "node_human_approval", "to_node": "node_paypal_tool", "is_default": True},
            {"from_node": "node_paypal_tool", "to_node": "node_memory_update", "is_default": True},
            {"from_node": "node_memory_update", "to_node": "node_terminal", "is_default": True},
        ],
    }


def _run_async(coro: Any) -> Any:
    """Runs a pure async coroutine to completion without creating a Windows loopback socketpair."""
    try:
        while True:
            coro.send(None)
    except StopIteration as stop:
        return stop.value


class TestDynamicLangGraphWorker(unittest.TestCase):
    """Tests dynamic StateGraph compilation, non-blocking pause/resume, and Gemini fallback."""

    def test_pause_on_human_approval_and_resume_to_completion(self) -> None:
        llm = FakeLLMReasoner()
        tools = FakeToolDispatcher()
        memory = FakeMemoryClient()
        engine = DynamicLangGraphEngine(llm, tools, memory)
        ir = _sample_refund_agent_ir(max_budget_usd=75.0)

        # Phase A: Initial run must pause non-blockingly at node_human_approval
        paused_state = _run_async(
            engine.execute_or_resume(
                agent_ir=ir,
                run_id="run_101",
                tenant_id="ten_paypal_01",
                inputs={"capture_id": "CAP_123"},
            )
        )

        self.assertEqual(paused_state["run_status"], "PAUSED_FOR_APPROVAL")
        self.assertTrue(paused_state["pause_requested"])
        self.assertEqual(paused_state["paused_at_node_id"], "node_human_approval")
        self.assertEqual(len(tools.dispatched_calls), 0)

        # Phase B: Resume from node_human_approval with APPROVED status and cryptographic token
        completed_state = _run_async(
            engine.execute_or_resume(
                agent_ir=ir,
                run_id="run_101",
                tenant_id="ten_paypal_01",
                inputs={"capture_id": "CAP_123"},
                prior_state=paused_state,
                resume_from_node_id="node_human_approval",
                approval_status="APPROVED",
                approval_token="atok_hmac_verified_999",
            )
        )

        self.assertEqual(completed_state["run_status"], "COMPLETED")
        self.assertAlmostEqual(completed_state["cumulative_spend"], 45.0)
        self.assertEqual(len(tools.dispatched_calls), 1)
        self.assertEqual(
            tools.dispatched_calls[0]["approval_token"], "atok_hmac_verified_999"
        )
        self.assertEqual(
            completed_state["variables"].get("paypal_refund_id"), "REFUND_SANDBOX_991"
        )

    def test_budget_cap_exceeded_halts_tool_execution(self) -> None:
        llm = FakeLLMReasoner()  # Outputs amount_usd=45.0
        tools = FakeToolDispatcher()
        memory = FakeMemoryClient()
        engine = DynamicLangGraphEngine(llm, tools, memory)
        # Set max_budget_usd=20.0 so 45.0 exceeds budget cap
        ir = _sample_refund_agent_ir(max_budget_usd=20.0)

        failed_state = _run_async(
            engine.execute_or_resume(
                agent_ir=ir,
                run_id="run_102",
                tenant_id="ten_paypal_01",
                inputs={"capture_id": "CAP_123"},
                resume_from_node_id="node_human_approval",
                approval_status="APPROVED",
                approval_token="atok_valid",
                prior_state={"variables": {"amount_usd": 45.0}, "inputs": {"capture_id": "CAP_123"}},
            )
        )

        self.assertEqual(failed_state["run_status"], "FAILED")
        self.assertIn("BUDGET_CAP_EXCEEDED", failed_state["error_message"])
        self.assertEqual(len(tools.dispatched_calls), 0)

    def test_gemini_sliding_window_and_multi_model_fallback(self) -> None:
        called_models: list[str] = []

        class _FakeChatModel:
            def __init__(self, name: str) -> None:
                self._name = name

            async def ainvoke(self, _messages: Any) -> Any:
                called_models.append(self._name)
                if self._name == "gemini-2.5-pro":
                    raise RuntimeError("429 Resource Exhausted")

                class _Resp:
                    content = '{"decision": "approve_refund", "amount_usd": 30.0}'

                return _Resp()

        cascade = LangChainGeminiCascade(
            api_key="test_key",
            models=["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
            rpm_per_model=1,
            window_seconds=60.0,
            model_factory=lambda model_name, _temp: _FakeChatModel(model_name),
        )

        # Call 1 uses gemini-2.5-flash and fills its RPM=1 sliding window
        res1 = _run_async(cascade.invoke_reasoning("sys", "user"))
        self.assertEqual(res1["_model_used"], "gemini-2.5-flash")

        # Call 2 skips gemini-2.5-flash (sliding window full), tries gemini-2.5-pro (raises 429),
        # and succeeds on gemini-2.0-flash!
        res2 = _run_async(cascade.invoke_reasoning("sys", "user"))
        self.assertEqual(res2["_model_used"], "gemini-2.0-flash")
        self.assertEqual(
            called_models,
            ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
        )

    def test_safe_ast_condition_evaluator(self) -> None:
        ctx = {"amount_usd": 45.0, "status": "DAMAGED", "verified": True}
        self.assertTrue(
            evaluate_condition_expression(
                "amount_usd <= 50 and status == 'DAMAGED' and verified == true", ctx
            )
        )
        self.assertFalse(
            evaluate_condition_expression("amount_usd > 100", ctx)
        )

    def test_deterministic_math_and_grounding_verifier_pipeline(self) -> None:
        class _GroundedExtractorLLM:
            async def invoke_reasoning(
                self,
                system_prompt: str,
                user_prompt: str,
                temperature: float = 0.0,
            ) -> dict[str, Any]:
                return {
                    "unit_price": 19.99,
                    "quantity": 3,
                    "discount": 5.00,
                    "confidence": 0.99,
                    "verbatim_quote": "3 units at $19.99 each, discount $5.00",
                    "source_chunk_id": "chunk_inv_882",
                }

        class _ChunkMemoryClient(FakeMemoryClient):
            async def retrieve_memories(
                self,
                tenant_id: str,
                agent_id: str,
                namespace: str,
                query: str,
                top_k: int = 5,
            ) -> tuple[list[dict[str, Any]], bool]:
                return [
                    {
                        "chunk_id": "chunk_inv_882",
                        "content": "Invoice #INV-882: 3 units at $19.99 each, discount $5.00 due upon receipt.",
                    }
                ], False

        ir = {
            "ir_version": "1.0.0",
            "agent_id": "agt_zero_hallucination_01",
            "tenant_id": "ten_paypal_01",
            "capabilities": [
                {
                    "capability_id": "paypal.captures.refund",
                    "version": "1.0.0",
                    "is_sensitive": True,
                    "allowed_actions": ["EXECUTE"],
                }
            ],
            "policies": {
                "read_only": False,
                "max_budget_usd": 100.0,
                "require_human_approval": True,
            },
            "memory": {
                "enable_semantic_memory": True,
                "memory_namespace": "ns_inv",
                "max_retrieval_k": 5,
            },
            "execution_limits": {
                "max_steps": 15,
                "timeout_seconds": 60,
                "max_loop_iterations": 1,
                "max_consecutive_errors": 2,
            },
            "nodes": [
                {
                    "id": "node_retrieve",
                    "type": "MEMORY_RETRIEVAL",
                    "description": "Retrieve invoice chunk",
                },
                {
                    "id": "node_extract",
                    "type": "LLM_REASONING",
                    "description": "Extract raw invoice parameters",
                },
                {
                    "id": "node_math",
                    "type": "DETERMINISTIC_MATH",
                    "description": "Compute exact refund total in Python Decimal",
                    "payload": {
                        "expression": "(unit_price * quantity) - discount",
                        "target_variable": "amount_usd",
                    },
                },
                {
                    "id": "node_verify_grounding",
                    "type": "GROUNDING_VERIFIER",
                    "description": "Verify verbatim quote and chunk citation",
                    "payload": {
                        "required_fields": ["unit_price", "quantity", "amount_usd"],
                        "min_confidence": 0.95,
                        "require_verbatim_quote": True,
                    },
                },
                {
                    "id": "node_tool",
                    "type": "TOOL_EXECUTION",
                    "description": "Execute PayPal refund",
                    "payload": {
                        "capability_id": "paypal.captures.refund",
                        "operation": "EXECUTE",
                    },
                },
            ],
            "transitions": [
                {"from_node": "node_retrieve", "to_node": "node_extract", "is_default": True},
                {"from_node": "node_extract", "to_node": "node_math", "is_default": True},
                {"from_node": "node_math", "to_node": "node_verify_grounding", "is_default": True},
                {"from_node": "node_verify_grounding", "to_node": "node_tool", "is_default": True},
            ],
        }

        tools = FakeToolDispatcher()
        engine = DynamicLangGraphEngine(_GroundedExtractorLLM(), tools, _ChunkMemoryClient())
        state = _run_async(
            engine.execute_or_resume(
                agent_ir=ir,
                run_id="run_zh_01",
                tenant_id="ten_paypal_01",
                inputs={"capture_id": "CAP_882"},
                approval_status="APPROVED",
                approval_token="atok_hmac_882",
            )
        )

        self.assertEqual(state["run_status"], "COMPLETED")
        self.assertAlmostEqual(state["variables"]["amount_usd"], 54.97)
        self.assertTrue(state["variables"]["deterministic_math_verified"])
        self.assertTrue(state["variables"]["grounding_verified"])
        self.assertEqual(state["variables"]["verified_chunk_id"], "chunk_inv_882")
        self.assertTrue(str(state["variables"]["idempotency_key"]).startswith("idem_"))

    def test_grounding_verifier_catches_hallucination_and_escalates_or_fails(self) -> None:
        # 1. Exact Decimal float drift test: 0.1 + 0.2 == 0.30
        self.assertEqual(evaluate_math_expression("a + b", {"a": 0.1, "b": 0.2}), 0.30)

        # 2. Fabricated quote must raise ValueError with GROUNDING_VERIFICATION_FAILED
        with self.assertRaises(ValueError) as ctx:
            verify_grounding_citations(
                variables={
                    "amount_usd": 500.0,
                    "confidence": 0.99,
                    "verbatim_quote": "Approved $500 bonus refund",
                    "source_chunk_id": "chunk_1",
                },
                inputs={},
                memory_context=[{"chunk_id": "chunk_1", "content": "Standard $25 fee receipt."}],
                require_verbatim_quote=True,
            )
        self.assertIn("GROUNDING_VERIFICATION_FAILED", str(ctx.exception))

        # 3. Deterministic idempotency key stability across key permutations
        k1 = compute_tool_idempotency_key(
            "ten_1", "run_1", 3, "paypal.captures.refund", "EXECUTE", {"a": 1, "b": 2}
        )
        k2 = compute_tool_idempotency_key(
            "ten_1", "run_1", 3, "paypal.captures.refund", "EXECUTE", {"b": 2, "a": 1}
        )
        self.assertEqual(k1, k2)

    def test_paypal_agent_toolkit_dispatcher_and_least_privilege_actions(self) -> None:
        # 1. Verify capability_id maps to PayPal Toolkit Configuration.actions
        resource, action, actions_cfg = build_paypal_toolkit_actions("paypal.orders.create")
        self.assertEqual(resource, "orders")
        self.assertEqual(action, "create")
        self.assertEqual(actions_cfg, {"orders": {"create": True}})

        # 2. Verify read_only=True blocks mutating actions in Configuration
        with self.assertRaises(PermissionError):
            build_paypal_toolkit_actions("paypal.invoices.send", read_only=True)

        # 3. Verify PayPalAgentToolkitDispatcher fails closed when credentials are missing
        unconfigured = PayPalAgentToolkitDispatcher(client_id="", client_secret="", sandbox=True)
        with self.assertRaises(RuntimeError) as err_ctx:
            _run_async(
                unconfigured.dispatch_tool(
                    run_id="run_1",
                    tenant_id="ten_1",
                    step_index=1,
                    capability_id="paypal.orders.create",
                    operation="EXECUTE",
                    parameters={"amount_usd": 50.0},
                )
            )
        self.assertIn("PAYPAL_CREDENTIALS_MISSING", str(err_ctx.exception))

        # 4. Verify PayPalAgentToolkitDispatcher invokes matched LangChain BaseTool from toolkit.get_tools()
        captured_actions: dict[str, Any] = {}

        class _FakePayPalLangChainTool:
            name = "create_order"

            async def ainvoke(self, tool_input: dict[str, Any]) -> str:
                return f'{{"id": "ORDER_PP_TOOLKIT_500", "status": "CREATED", "amount": {tool_input.get("amount_usd", 0)}}}'

        class _FakePayPalToolkit:
            def get_tools(self) -> list[Any]:
                return [_FakePayPalLangChainTool()]

        def _fake_factory(
            client_id: str,
            secret: str,
            sandbox: bool,
            actions: dict[str, dict[str, bool]],
        ) -> Any:
            captured_actions["client_id"] = client_id
            captured_actions["sandbox"] = sandbox
            captured_actions["actions"] = actions
            return _FakePayPalToolkit()

        dispatcher = PayPalAgentToolkitDispatcher(
            client_id="pp_client_id_test",
            client_secret="pp_secret_test",
            sandbox=True,
            toolkit_factory=_fake_factory,
        )
        result = _run_async(
            dispatcher.dispatch_tool(
                run_id="run_pp_1",
                tenant_id="ten_pp_1",
                step_index=2,
                capability_id="paypal.orders.create",
                operation="EXECUTE",
                parameters={"amount_usd": 50.0, "currency": "USD"},
            )
        )
        self.assertEqual(result["id"], "ORDER_PP_TOOLKIT_500")
        self.assertEqual(result["toolkit"], "paypal-agent-toolkit")
        self.assertEqual(captured_actions["actions"], {"orders": {"create": True}})
        self.assertTrue(captured_actions["sandbox"])


if __name__ == "__main__":
    unittest.main()
