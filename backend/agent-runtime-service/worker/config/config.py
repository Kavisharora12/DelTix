"""Configuration loader for the DelTix Python LangGraph Runtime Worker."""

from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]


DEFAULT_GEMINI_MODELS: list[str] = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


def _load_env_files() -> None:
    """Loads environment variables from worker/.env or repository root .env if present."""
    worker_dir = Path(__file__).resolve().parent.parent
    root_dir = worker_dir.parent.parent.parent
    for env_path in (worker_dir / ".env", root_dir / ".env"):
        if not env_path.is_file():
            continue
        if load_dotenv is not None:
            load_dotenv(dotenv_path=env_path, override=False)
        else:
            for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


@dataclass(frozen=True)
class WorkerConfig:
    """Immutable runtime configuration for the LangGraph execution worker."""

    http_port: int = 8085
    gemini_api_key: str = ""
    gemini_models: list[str] = field(default_factory=lambda: list(DEFAULT_GEMINI_MODELS))
    gemini_rpm_per_model: int = 15
    gemini_sliding_window_seconds: float = 60.0
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_sandbox: bool = True
    langchain_tracing_v2: bool = False
    langchain_project: str = "deltix-agent-runtime"
    memory_service_url: str = "http://localhost:8083"
    capability_policy_service_url: str = "http://localhost:8084"
    http_timeout_seconds: float = 15.0


def load_worker_config_from_env() -> WorkerConfig:
    """Loads worker configuration from .env / environment variables and configures LangSmith + PayPal Toolkit."""
    _load_env_files()

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

    paypal_env = os.getenv("PAYPAL_ENVIRONMENT", "SANDBOX").strip().upper()
    paypal_sandbox = paypal_env != "PRODUCTION" and paypal_env != "LIVE"

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
        paypal_client_id=os.getenv("PAYPAL_CLIENT_ID", "").strip(),
        paypal_client_secret=os.getenv("PAYPAL_CLIENT_SECRET", "").strip(),
        paypal_sandbox=paypal_sandbox,
        langchain_tracing_v2=tracing_enabled,
        langchain_project=project_name,
        memory_service_url=os.getenv("MEMORY_SERVICE_URL", "http://localhost:8083").rstrip("/"),
        capability_policy_service_url=os.getenv(
            "CAPABILITY_POLICY_SERVICE_URL", "http://localhost:8084"
        ).rstrip("/"),
    )
