"""FastAPI entrypoint for the DelTix Memory Service."""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from config.config import load_memory_config_from_env
from routes.routes import api_router

app = FastAPI(title="DelTix Memory Service", version="1.0.0")
app.include_router(api_router)


@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    config = load_memory_config_from_env()
    uvicorn.run("main:app", host="0.0.0.0", port=config.http_port, reload=False)
