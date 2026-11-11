"""FastAPI internal HTTP server bridging the Go Runtime Controller (:8082) and Python LangGraph Worker (:8085)."""

from __future__ import annotations

import asyncio
from concurrent import futures
import json
import os
from typing import Any

import grpc

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from config.config import WorkerConfig, load_worker_config_from_env
from core.state_graph import DynamicLangGraphEngine
from services.executor_service import (
    HTTPMemoryClient,
    HTTPToolDispatcher,
    LangChainGeminiCascade,
    PayPalAgentToolkitDispatcher,
    ToolDispatcherProtocol,
)


class ExecuteGraphRequest(BaseModel):
    """Request payload sent by the Go Runtime Control Plane to start or resume a run."""

    run_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    agent_ir: dict[str, Any]
    inputs: dict[str, Any] = Field(default_factory=dict)
    prior_state: dict[str, Any] | None = None
    resume_from_node_id: str | None = None
    approval_status: str = ""
    approval_token: str = ""


class ResumeGraphRequest(BaseModel):
    """Request payload sent by the Go Runtime Control Plane when resuming a paused run."""

    run_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    agent_ir: dict[str, Any]
    prior_state: dict[str, Any]
    resume_from_node_id: str = Field(..., min_length=1)
    approval_status: str = Field(default="APPROVED")
    approval_token: str = Field(..., min_length=1)


class WorkerExecutionResponse(BaseModel):
    """Structured execution result returned to the Go Runtime Control Plane."""

    run_id: str
    tenant_id: str
    run_status: str
    step_index: int
    current_node_id: str
    pause_requested: bool = False
    paused_at_node_id: str = ""
    pause_summary: str = ""
    cumulative_spend: float
    variables: dict[str, Any]
    memory_degraded: bool
    error_message: str = ""
    checkpoints: list[dict[str, Any]]
    state_snapshot: dict[str, Any]
    final_state: dict[str, Any]


def create_worker_app(
    engine: DynamicLangGraphEngine | None = None,
    cfg: WorkerConfig | None = None,
) -> FastAPI:
    """Creates the FastAPI application for the LangGraph execution worker."""
    resolved_cfg = cfg or load_worker_config_from_env()

    if engine is None:
        llm_cascade = LangChainGeminiCascade(
            api_key=resolved_cfg.gemini_api_key,
            models=resolved_cfg.gemini_models,
            rpm_per_model=resolved_cfg.gemini_rpm_per_model,
            window_seconds=resolved_cfg.gemini_sliding_window_seconds,
        )
        http_dispatcher = HTTPToolDispatcher(
            base_url=resolved_cfg.capability_policy_service_url,
            timeout_seconds=resolved_cfg.http_timeout_seconds,
        )
        # Financial Safety & Policy Invariant (Rule §2 & Rule §8):
        # All tool executions MUST route through Capability & Policy Service (:8084)
        # to guarantee pre-mutation intent recording, fail-closed policy checks,
        # idempotency locking, and cryptographic audit hashing before real money moves.
        tool_dispatcher: ToolDispatcherProtocol = http_dispatcher

        memory_client = HTTPMemoryClient(
            base_url=resolved_cfg.memory_service_url,
        )
        engine = DynamicLangGraphEngine(
            llm_reasoner=llm_cascade,
            tool_dispatcher=tool_dispatcher,
            memory_client=memory_client,
        )

    app = FastAPI(
        title="DelTix LangGraph Runtime Worker",
        version="1.0.0",
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, Any]:
        return {
            "status": "ok",
            "service": "agent-runtime-worker",
            "gemini_models": resolved_cfg.gemini_models,
            "paypal_toolkit_configured": bool(
                resolved_cfg.paypal_client_id and resolved_cfg.paypal_client_secret
            ),
            "paypal_sandbox": resolved_cfg.paypal_sandbox,
            "langsmith_tracing": resolved_cfg.langchain_tracing_v2,
            "langsmith_project": resolved_cfg.langchain_project,
            "langsmith_configured": bool(
                resolved_cfg.langchain_api_key or os.getenv("LANGCHAIN_API_KEY")
            ),
        }

    @app.post("/internal/v1/worker/execute", response_model=WorkerExecutionResponse)
    async def execute_graph(req: ExecuteGraphRequest) -> WorkerExecutionResponse:
        try:
            final_state = await engine.execute_or_resume(
                agent_ir=req.agent_ir,
                run_id=req.run_id,
                tenant_id=req.tenant_id,
                inputs=req.inputs,
                prior_state=req.prior_state,
                resume_from_node_id=req.resume_from_node_id,
                approval_status=req.approval_status,
                approval_token=req.approval_token,
            )
            return _to_worker_response(final_state)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/internal/v1/worker/resume", response_model=WorkerExecutionResponse)
    async def resume_graph(req: ResumeGraphRequest) -> WorkerExecutionResponse:
        if req.approval_status == "REJECTED":
            return WorkerExecutionResponse(
                run_id=req.run_id,
                tenant_id=req.tenant_id,
                run_status="REJECTED",
                step_index=int(req.prior_state.get("step_index", 0)),
                current_node_id=req.resume_from_node_id,
                cumulative_spend=float(req.prior_state.get("cumulative_spend", 0.0)),
                variables=dict(req.prior_state.get("variables") or {}),
                memory_degraded=bool(req.prior_state.get("memory_degraded", False)),
                error_message="Operator rejected human approval request.",
                checkpoints=[],
                state_snapshot=req.prior_state,
                final_state=req.prior_state,
            )

        try:
            final_state = await engine.execute_or_resume(
                agent_ir=req.agent_ir,
                run_id=req.run_id,
                tenant_id=req.tenant_id,
                inputs=dict(req.prior_state.get("inputs") or {}),
                prior_state=req.prior_state,
                resume_from_node_id=req.resume_from_node_id,
                approval_status=req.approval_status,
                approval_token=req.approval_token,
            )
            return _to_worker_response(final_state)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app


def _to_worker_response(state: dict[str, Any]) -> WorkerExecutionResponse:
    snapshot = {
        "step_index": state["step_index"],
        "current_node_id": state["current_node_id"],
        "cumulative_spend": state["cumulative_spend"],
        "inputs": state["inputs"],
        "variables": state["variables"],
        "memory_context": state["memory_context"],
        "memory_degraded": state["memory_degraded"],
    }
    return WorkerExecutionResponse(
        run_id=state["run_id"],
        tenant_id=state["tenant_id"],
        run_status=state["run_status"],
        step_index=state["step_index"],
        current_node_id=state["current_node_id"],
        pause_requested=bool(state.get("pause_requested", False)),
        paused_at_node_id=state["paused_at_node_id"],
        pause_summary=state["pause_summary"],
        cumulative_spend=state["cumulative_spend"],
        variables=state["variables"],
        memory_degraded=state["memory_degraded"],
        error_message=state["error_message"],
        checkpoints=state["checkpoints"],
        state_snapshot=snapshot,
        final_state=snapshot,
    )


try:
    from api import runtime_pb2, runtime_pb2_grpc
except ImportError:
    import runtime_pb2, runtime_pb2_grpc  # type: ignore[no-redef]


class AgentExecutionGRPCServicer(runtime_pb2_grpc.AgentExecutionServiceServicer):
    """gRPC implementation of the AgentExecutionService protocol."""

    def __init__(self, engine: DynamicLangGraphEngine, cfg: WorkerConfig | None = None) -> None:
        self.engine = engine
        self.cfg = cfg or load_worker_config_from_env()

    def ExecuteGraph(
        self, request: runtime_pb2.ExecuteGraphRequest, context: grpc.ServicerContext
    ) -> runtime_pb2.ExecuteGraphResponse:
        try:
            agent_ir = json.loads(request.agent_ir_json)
            inputs = json.loads(request.inputs_json) if request.inputs_json else {}
            prior_state = json.loads(request.prior_state_json) if request.prior_state_json else None

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                final_state = loop.run_until_complete(
                    self.engine.execute_or_resume(
                        agent_ir=agent_ir,
                        run_id=request.run_id,
                        tenant_id=request.tenant_id,
                        inputs=inputs,
                        prior_state=prior_state,
                        resume_from_node_id=request.resume_from_node_id or None,
                        approval_status=request.approval_status,
                        approval_token=request.approval_token,
                    )
                )
            finally:
                loop.close()

            return _to_grpc_response(final_state)
        except Exception as exc:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return runtime_pb2.ExecuteGraphResponse(
                run_id=request.run_id,
                tenant_id=request.tenant_id,
                run_status="FAILED",
                error_message=str(exc),
            )

    def ResumeExecution(
        self, request: runtime_pb2.ResumeExecutionRequest, context: grpc.ServicerContext
    ) -> runtime_pb2.ExecuteGraphResponse:
        try:
            agent_ir = json.loads(request.agent_ir_json)
            prior_state = json.loads(request.prior_state_json) if request.prior_state_json else {}

            if request.approval_status == "REJECTED":
                return runtime_pb2.ExecuteGraphResponse(
                    run_id=request.run_id,
                    tenant_id=request.tenant_id,
                    run_status="REJECTED",
                    step_index=int(prior_state.get("step_index", 0)),
                    current_node_id=request.resume_from_node_id,
                    cumulative_spend=float(prior_state.get("cumulative_spend", 0.0)),
                    variables_json=json.dumps(dict(prior_state.get("variables") or {})),
                    memory_degraded=bool(prior_state.get("memory_degraded", False)),
                    error_message="Operator rejected human approval request.",
                    state_snapshot_json=json.dumps(prior_state),
                    final_state_json=json.dumps(prior_state),
                )

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                final_state = loop.run_until_complete(
                    self.engine.execute_or_resume(
                        agent_ir=agent_ir,
                        run_id=request.run_id,
                        tenant_id=request.tenant_id,
                        inputs=dict(prior_state.get("inputs") or {}),
                        prior_state=prior_state,
                        resume_from_node_id=request.resume_from_node_id,
                        approval_status=request.approval_status,
                        approval_token=request.approval_token,
                    )
                )
            finally:
                loop.close()

            return _to_grpc_response(final_state)
        except Exception as exc:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return runtime_pb2.ExecuteGraphResponse(
                run_id=request.run_id,
                tenant_id=request.tenant_id,
                run_status="FAILED",
                error_message=str(exc),
            )

    def HealthCheck(
        self, request: runtime_pb2.HealthCheckRequest, context: grpc.ServicerContext
    ) -> runtime_pb2.HealthCheckResponse:
        return runtime_pb2.HealthCheckResponse(
            status="ok",
            version="1.0.0",
            paypal_configured=bool(
                self.cfg.paypal_client_id and self.cfg.paypal_client_secret
            ),
        )


def _to_grpc_response(state: dict[str, Any]) -> runtime_pb2.ExecuteGraphResponse:
    snapshot = {
        "step_index": state["step_index"],
        "current_node_id": state["current_node_id"],
        "cumulative_spend": state["cumulative_spend"],
        "inputs": state["inputs"],
        "variables": state["variables"],
        "memory_context": state["memory_context"],
        "memory_degraded": state["memory_degraded"],
    }
    checkpoints = []
    for cp in state.get("checkpoints", []):
        checkpoints.append(
            runtime_pb2.CheckpointItem(
                step_index=cp.get("step_index", 0),
                node_id=cp.get("node_id", ""),
                node_type=str(cp.get("node_type", "")),
                node_input_json=json.dumps(cp.get("node_input", {})),
                node_output_json=json.dumps(cp.get("node_output", {})),
                status=cp.get("status", ""),
                duration_ms=int(cp.get("duration_ms", 0)),
            )
        )
    return runtime_pb2.ExecuteGraphResponse(
        run_id=state["run_id"],
        tenant_id=state["tenant_id"],
        run_status=state["run_status"],
        step_index=state["step_index"],
        current_node_id=state["current_node_id"],
        pause_requested=bool(state.get("pause_requested", False)),
        paused_at_node_id=state.get("paused_at_node_id", ""),
        pause_summary=state.get("pause_summary", ""),
        cumulative_spend=float(state.get("cumulative_spend", 0.0)),
        variables_json=json.dumps(state.get("variables", {})),
        memory_degraded=bool(state.get("memory_degraded", False)),
        error_message=state.get("error_message", ""),
        checkpoints=checkpoints,
        state_snapshot_json=json.dumps(snapshot),
        final_state_json=json.dumps(snapshot),
    )


def create_grpc_server(
    engine: DynamicLangGraphEngine,
    cfg: WorkerConfig | None = None,
    max_workers: int = 10,
) -> grpc.Server:
    """Builds and returns a configured gRPC server instance."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    servicer = AgentExecutionGRPCServicer(engine=engine, cfg=cfg)
    runtime_pb2_grpc.add_AgentExecutionServiceServicer_to_server(servicer, server)
    return server

