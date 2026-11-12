"""Environment-backed configuration for the Memory Service."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

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
    mem0_api_key: str = ""
    database_host: str = ""
    database_port: int = 5432
    database_user: str = "postgres"
    database_password: str = ""
    database_name: str = "postgres"
    database_sslmode: str = "require"
    collection_name: str = "deltix_agent_memories"
    embedding_provider: str = "gemini"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    embedding_model: str = "models/text-embedding-004"
    embedding_dimensions: int = 768
    llm_model: str = "gemini-2.0-flash"
    redis_url: str = ""
    cache_ttl_seconds: int = 3600
    default_limit: int = 3
    max_limit: int = 5
    similarity_threshold: float = 0.70
    retention_days: int = 90

    def validate_storage(self) -> None:
        if self.mem0_api_key:
            # Mem0 Cloud manages embeddings and storage externally
            return
        missing = []
        if not self.database_host:
            missing.append("database_host (set via SUPABASE_DB_URL, RAG_VECTOR_DB_URL, or MEMORY_DB_HOST)")
        if not self.database_password:
            missing.append("database_password (set via SUPABASE_DB_URL, RAG_VECTOR_DB_URL, or MEMORY_DB_PASSWORD)")
        if not (self.gemini_api_key or self.openai_api_key):
            missing.append("GEMINI_API_KEY (or OPENAI_API_KEY or MEM0_API_KEY)")
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


def _parse_database_url(url: str) -> dict[str, str | int]:
    """Parse PostgreSQL connection string (Supabase / Neon / standard pgvector)."""
    if not url or "[YOUR-PASSWORD]" in url:
        return {}

    sanitized_url = url
    if "://" in url and "@" in url:
        scheme, rest = url.split("://", 1)
        user_info, host_and_path = rest.rsplit("@", 1)
        if ":" in user_info:
            raw_user, raw_pass = user_info.split(":", 1)
            if raw_pass.startswith("[") and raw_pass.endswith("]") and len(raw_pass) >= 2:
                raw_pass = raw_pass[1:-1]
            safe_user = quote(unquote(raw_user), safe="")
            safe_pass = quote(unquote(raw_pass), safe="")
            sanitized_url = f"{scheme}://{safe_user}:{safe_pass}@{host_and_path}"

    try:
        parsed = urlparse(sanitized_url)
    except ValueError:
        return {}

    result: dict[str, str | int] = {}
    if parsed.hostname:
        result["host"] = parsed.hostname
    if parsed.port:
        result["port"] = parsed.port
    if parsed.username:
        result["user"] = unquote(parsed.username)
    if parsed.password:
        result["password"] = unquote(parsed.password)
    path = parsed.path.lstrip("/")
    if path:
        result["name"] = path
    if parsed.query:
        query_params = parse_qs(parsed.query)
        if "sslmode" in query_params:
            result["sslmode"] = query_params["sslmode"][0]
    return result


def load_memory_config_from_env() -> MemoryConfig:
    """Load memory-service settings from process environment and local .env files."""
    _load_env_files()

    db_url = (
        os.getenv("RAG_VECTOR_DB_URL", "").strip()
        or os.getenv("SUPABASE_DB_URL", "").strip()
        or os.getenv("MEMORY_DB_URL", "").strip()
    )
    parsed_db = _parse_database_url(db_url)

    db_host = os.getenv("MEMORY_DB_HOST", "").strip() or str(parsed_db.get("host", ""))
    db_port = int(os.getenv("MEMORY_DB_PORT", str(parsed_db.get("port", 5432))))
    db_user = os.getenv("MEMORY_DB_USER", "").strip() or str(parsed_db.get("user", "postgres"))
    db_password = os.getenv("MEMORY_DB_PASSWORD", "").strip() or str(parsed_db.get("password", ""))
    db_name = os.getenv("MEMORY_DB_NAME", "").strip() or str(parsed_db.get("name", "postgres"))
    db_sslmode = os.getenv("MEMORY_DB_SSLMODE", "").strip() or str(parsed_db.get("sslmode", "require"))

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    mem0_key = os.getenv("MEM0_API_KEY", "").strip()

    provider_env = os.getenv("MEMORY_EMBEDDING_PROVIDER", "").strip().lower()
    if provider_env in ("gemini", "openai"):
        embedding_provider = provider_env
    elif gemini_key:
        embedding_provider = "gemini"
    elif openai_key:
        embedding_provider = "openai"
    else:
        embedding_provider = "gemini"

    if embedding_provider == "gemini":
        default_model = "models/text-embedding-004"
        default_dims = 768
        default_llm = "gemini-2.0-flash"
    else:
        default_model = "text-embedding-3-small"
        default_dims = 1536
        default_llm = "gpt-4o-mini"

    embedding_model = os.getenv("MEMORY_EMBEDDING_MODEL", default_model).strip()
    embedding_dims = int(os.getenv("MEMORY_EMBEDDING_DIMENSIONS", str(default_dims)))
    llm_model = os.getenv("MEMORY_LLM_MODEL", default_llm).strip()

    redis_url = (
        os.getenv("UPSTASH_REDIS_URL", "").strip()
        or os.getenv("REDIS_URL", "").strip()
        or os.getenv("MEMORY_REDIS_URL", "").strip()
    )

    return MemoryConfig(
        http_port=int(os.getenv("MEMORY_HTTP_PORT") or os.getenv("MEMORY_SERVICE_PORT", "8083")),
        mem0_api_key=mem0_key,
        database_host=db_host,
        database_port=db_port,
        database_user=db_user,
        database_password=db_password,
        database_name=db_name,
        database_sslmode=db_sslmode,
        collection_name=os.getenv("MEMORY_COLLECTION_NAME", "deltix_agent_memories").strip(),
        embedding_provider=embedding_provider,
        gemini_api_key=gemini_key,
        openai_api_key=openai_key,
        embedding_model=embedding_model,
        embedding_dimensions=embedding_dims,
        llm_model=llm_model,
        redis_url=redis_url,
        cache_ttl_seconds=int(os.getenv("MEMORY_CACHE_TTL_SECONDS", "3600")),
        default_limit=int(os.getenv("MEMORY_DEFAULT_LIMIT", "3")),
        max_limit=int(os.getenv("MEMORY_MAX_LIMIT", "5")),
        similarity_threshold=float(os.getenv("MEMORY_SIMILARITY_THRESHOLD", "0.70")),
        retention_days=int(os.getenv("MEMORY_RETENTION_DAYS", "90")),
    )
