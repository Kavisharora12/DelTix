"""Environment-backed configuration for the Memory Service."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dotenv is installed in service deployments
    load_dotenv = None


def _load_env_files() -> None:
    service_dir = Path(__file__).resolve().parent.parent
    repo_dir = service_dir.parent.parent
    if load_dotenv is not None:
        for path in (service_dir / ".env", repo_dir / ".env"):
            if path.is_file():
                load_dotenv(path, override=False)


@dataclass(frozen=True)
class MemoryConfig:
    """Immutable service settings."""

    http_port: int = 8083
    database_host: str = ""
    database_port: int = 5432
    database_user: str = "postgres"
    database_password: str = ""
    database_name: str = "postgres"
    database_sslmode: str = "require"
    collection_name: str = "deltix_agent_memories"
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    redis_url: str = ""
    cache_ttl_seconds: int = 3600
    default_limit: int = 3
    max_limit: int = 5
    similarity_threshold: float = 0.70
    retention_days: int = 90

    def validate_storage(self) -> None:
        missing = [
            name
            for name, value in (
                ("MEMORY_DB_HOST", self.database_host),
                ("MEMORY_DB_PASSWORD", self.database_password),
                ("OPENAI_API_KEY", self.openai_api_key),
            )
            if not value
        ]
        if missing:
            raise ValueError(f"Missing required memory-service settings: {', '.join(missing)}")
        if not 1 <= self.default_limit <= self.max_limit <= 100:
            raise ValueError("Memory result limits must satisfy 1 <= default <= max <= 100")
        if self.collection_name == "mem0_memories":
            raise ValueError("MEMORY_COLLECTION_NAME cannot use the obsolete mem0_memories table")
        if self.retention_days <= 0 or self.cache_ttl_seconds <= 0:
            raise ValueError("Memory retention and cache TTL must be positive")
        if not 0 <= self.similarity_threshold <= 1:
            raise ValueError("MEMORY_SIMILARITY_THRESHOLD must be between 0 and 1")


def load_memory_config_from_env() -> MemoryConfig:
    """Load memory-service settings from process environment and local .env files."""
    _load_env_files()
    return MemoryConfig(
        http_port=int(os.getenv("MEMORY_SERVICE_PORT", "8083")),
        database_host=os.getenv("MEMORY_DB_HOST", "").strip(),
        database_port=int(os.getenv("MEMORY_DB_PORT", "5432")),
        database_user=os.getenv("MEMORY_DB_USER", "postgres").strip(),
        database_password=os.getenv("MEMORY_DB_PASSWORD", "").strip(),
        database_name=os.getenv("MEMORY_DB_NAME", "postgres").strip(),
        database_sslmode=os.getenv("MEMORY_DB_SSLMODE", "require").strip(),
        collection_name=os.getenv("MEMORY_COLLECTION_NAME", "deltix_agent_memories").strip(),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        embedding_model=os.getenv("MEMORY_EMBEDDING_MODEL", "text-embedding-3-small").strip(),
        embedding_dimensions=int(os.getenv("MEMORY_EMBEDDING_DIMENSIONS", "1536")),
        redis_url=os.getenv("REDIS_URL", "").strip(),
        cache_ttl_seconds=int(os.getenv("MEMORY_CACHE_TTL_SECONDS", "3600")),
        default_limit=int(os.getenv("MEMORY_DEFAULT_LIMIT", "3")),
        max_limit=int(os.getenv("MEMORY_MAX_LIMIT", "5")),
        similarity_threshold=float(os.getenv("MEMORY_SIMILARITY_THRESHOLD", "0.70")),
        retention_days=int(os.getenv("MEMORY_RETENTION_DAYS", "90")),
    )
