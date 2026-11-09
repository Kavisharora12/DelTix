"""Entrypoint for the DelTix Python LangGraph Runtime Worker (:8085)."""

from __future__ import annotations

import uvicorn

from api.grpc_server import create_worker_app
from config.config import load_worker_config_from_env


app = create_worker_app()


if __name__ == "__main__":
    cfg = load_worker_config_from_env()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=cfg.http_port,
        reload=False,
    )
