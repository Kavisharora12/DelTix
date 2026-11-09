"""Configuration loader for the DelTix Python LangGraph Runtime Worker."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


DEFAULT_GEMINI_MODELS: list[str] = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


@dataclass(frozen=True)
class WorkerConfig:
    """Immutable runtime configuration for the LangGraph execution worker."""

    http_port: int = 8085
    gemini_api_key: str = ""
    gemini_models: list[str] = field(default_factory=lambda: list(DEFAULT_GEMINI_MODELS))
    gemini_rpm_per_model: int = 15
    gemini_sliding_window_seconds: float = 60.0
    langchain_tracing_v2: bool = False
    langchain_project: str = "deltix-agent-runtime"
    memory_service_url: str = "http://localhost:8083"
    capability_policy_service_url: str = "http://localhost:8084"
    http_timeout_seconds: float = 15.0


def load_worker_config_from_env() -> WorkerConfig:
    """Loads worker configuration from environment variables and configures LangSmith."""
    gemini_key = (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
        or os.getenv("LLM_API_KEY", "").strip()
    )

    raw_models = os.getenv("GEMINI_MODELS", "").strip()
    if raw_models:
        models = [m.strip() for m in raw_models.split(",") if m.strip()]
    else:
        models = list(DEFAULT_GEMINI_MODELS)

    tracing_enabled = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true"
    project_name = os.getenv("LANGCHAIN_PROJECT", "deltix-agent-runtime").strip()
    if tracing_enabled:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_PROJECT"] = project_name

    return WorkerConfig(
        http_port=int(os.getenv("WORKER_HTTP_PORT", "8085")),
        gemini_api_key=gemini_key,
        gemini_models=models,
        gemini_rpm_per_model=int(os.getenv("GEMINI_RPM_PER_MODEL", "15")),
        gemini_sliding_window_seconds=float(os.getenv("GEMINI_WINDOW_SECONDS", "60.0")),
        langchain_tracing_v2=tracing_enabled,
        langchain_project=project_name,
        # TODO(workstream-4): Connect to Mem0 Memory Service (:8083) once running.
        memory_service_url=os.getenv("MEMORY_SERVICE_URL", "http://localhost:8083").rstrip("/"),
        # TODO(workstream-5): Connect to Capability & Policy Service (:8084) once running.
        capability_policy_service_url=os.getenv(
            "CAPABILITY_POLICY_SERVICE_URL", "http://localhost:8084"
        ).rstrip("/"),
    )
