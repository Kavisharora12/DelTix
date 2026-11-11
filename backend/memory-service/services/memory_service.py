"""Mem0-backed memory operations with tenant-scoped caching and pruning."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import re
from typing import Any

from config.config import load_memory_config_from_env
from models.memory_models import MemoryItem
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

_CARD_CANDIDATE = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_CVV = re.compile(
    r"(?i)\b(?:cvv|cvc|cvv2|cvc2|security code)\b(\s*[:=]\s*)\d{3,4}\b"
)
_PAYMENT_TOKEN = re.compile(
    r"(?i)\b(authorization|access[_ -]?token|refresh[_ -]?token|"
    r"payment[_ -]?token|paypal[_ -]?token|client[_ -]?secret)\b"
    r"(\s*[:=]\s*)(?:bearer\s+)?[A-Za-z0-9._~+/=-]{8,}"
)


class MemoryConfigurationError(RuntimeError):
    """Raised when required storage or embedding settings are unavailable."""


def redact_pii(text: str) -> str:
    """Remove payment card numbers, CVVs, and payment credentials before storage."""
    text = _CARD_CANDIDATE.sub("[REDACTED_CARD]", text)
    text = _CVV.sub(
        lambda match: (
            f"{match.group(0).split(match.group(1), 1)[0]}"
            f"{match.group(1)}[REDACTED]"
        ),
        text,
    )
    return _PAYMENT_TOKEN.sub(lambda match: f"{match.group(1)}{match.group(2)}[REDACTED]", text)


def _tenant_digest(tenant_id: str) -> str:
    return hashlib.sha256(tenant_id.encode("utf-8")).hexdigest()


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _memories_from_result(result: Any) -> list[dict[str, Any]]:
    if isinstance(result, dict):
        items = result.get("results")
        if items is None:
            items = [result] if result.get("id") or result.get("memory") else []
    elif isinstance(result, list):
        items = result
    else:
        items = []
    return [item for item in items if isinstance(item, dict)]


def _to_memory_item(memory: dict[str, Any]) -> MemoryItem | None:
    identifier = memory.get("id")
    text = memory.get("memory", memory.get("text", memory.get("content")))
    if identifier is None or not isinstance(text, str):
        return None
    raw_score = memory.get("score")
    try:
        score = float(raw_score) if raw_score is not None else None
    except (TypeError, ValueError):
        score = None
    return MemoryItem(
        id=str(identifier),
        text=redact_pii(text),
        score=score,
        created_at=_parse_datetime(memory.get("created_at")),
    )


class MemoryService:
    """Thin, testable application layer around Mem0 and Redis."""

    def __init__(
        self,
        memory_client: Any,
        cache_client: Any | None,
        *,
        retention_days: int = 90,
        cache_ttl_seconds: int = 3600,
        default_limit: int = 3,
        max_limit: int = 5,
        similarity_threshold: float = 0.70,
    ) -> None:
        self._memory = memory_client
        self._cache = cache_client
        self._retention_days = retention_days
        self._cache_ttl_seconds = cache_ttl_seconds
        self._default_limit = default_limit
        self._max_limit = max_limit
        self._similarity_threshold = similarity_threshold

    @classmethod
    def from_env(cls) -> "MemoryService":
        try:
            config = load_memory_config_from_env()
            config.validate_storage()
        except (TypeError, ValueError) as exc:
            raise MemoryConfigurationError(str(exc)) from exc

        if config.mem0_api_key:
            from mem0 import MemoryClient

            memory_client = MemoryClient(api_key=config.mem0_api_key)
        else:
            from mem0 import Memory

            if config.embedding_provider == "gemini":
                embedder_config = {
                    "provider": "gemini",
                    "config": {
                        "model": config.embedding_model,
                        "api_key": config.gemini_api_key,
                    },
                }
                llm_config = {
                    "provider": "gemini",
                    "config": {
                        "model": config.llm_model,
                        "api_key": config.gemini_api_key,
                    },
                }
            else:
                embedder_config = {
                    "provider": "openai",
                    "config": {
                        "model": config.embedding_model,
                        "api_key": config.openai_api_key,
                    },
                }
                llm_config = {
                    "provider": "openai",
                    "config": {
                        "model": config.llm_model,
                        "api_key": config.openai_api_key,
                    },
                }

            mem0_config = {
                "version": "v1.1",
                "embedder": embedder_config,
                "llm": llm_config,
                "vector_store": {
                    "provider": "pgvector",
                    "config": {
                        "host": config.database_host,
                        "port": config.database_port,
                        "user": config.database_user,
                        "password": config.database_password,
                        "dbname": config.database_name,
                        "sslmode": config.database_sslmode,
                        "collection_name": config.collection_name,
                        "embedding_model_dims": config.embedding_dimensions,
                    },
                },
            }

            memory_client = Memory.from_config(mem0_config)
        cache_client = None
        if config.redis_url:
            from redis import Redis

            cache_client = Redis.from_url(config.redis_url, decode_responses=True)
        return cls(
            memory_client,
            cache_client,
            retention_days=config.retention_days,
            cache_ttl_seconds=config.cache_ttl_seconds,
            default_limit=config.default_limit,
            max_limit=config.max_limit,
            similarity_threshold=config.similarity_threshold,
        )

    def store(self, tenant_id: str, agent_id: str, messages: list[dict[str, str]]) -> list[MemoryItem]:
        safe_messages = [
            {"role": message["role"], "content": redact_pii(message["content"])}
            for message in messages
        ]
        result = self._memory.add(
            safe_messages,
            user_id=tenant_id,
            agent_id=agent_id,
            metadata={"tenant_id": tenant_id, "agent_id": agent_id},
        )
        self._invalidate_tenant_cache(tenant_id)
        items = [
            item
            for raw in _memories_from_result(result)
            if (item := _to_memory_item(raw)) is not None
        ]
        if not items and isinstance(result, dict) and result.get("event_id"):
            last_msg = safe_messages[-1]["content"] if safe_messages else ""
            items = [
                MemoryItem(
                    id=str(result["event_id"]),
                    text=last_msg,
                    score=None,
                    created_at=datetime.now(timezone.utc),
                )
            ]
        return items

    def retrieve(
        self, tenant_id: str, agent_id: str, query: str, limit: int | None = None
    ) -> list[MemoryItem]:
        requested_limit = self._default_limit if limit is None else limit
        if not 1 <= requested_limit <= self._max_limit:
            raise ValueError(f"limit must be between 1 and {self._max_limit}")

        cache_key = self._cache_key(tenant_id, agent_id, query, requested_limit)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return [MemoryItem.model_validate(item) for item in cached]

        try:
            result = self._memory.search(
                query,
                filters={"user_id": tenant_id},
            )
        except Exception:
            try:
                result = self._memory.search(
                    query,
                    filters={"user_id": tenant_id, "agent_id": agent_id},
                )
            except Exception:
                try:
                    result = self._memory.search(query, user_id=tenant_id)
                except Exception as exc:
                    logger.warning("Memory search query failed: %s", exc)
                    result = []
        memories: list[MemoryItem] = []
        for raw in _memories_from_result(result):
            item = _to_memory_item(raw)
            if item is None:
                continue
            if item.score is not None and item.score < self._similarity_threshold:
                continue
            memories.append(item)
        self._cache_set(cache_key, [item.model_dump(mode="json") for item in memories])
        return memories

    def delete(self, tenant_id: str, agent_id: str, memory_id: str) -> bool:
        memory = self._memory.get(memory_id)
        if (
            not isinstance(memory, dict)
            or memory.get("user_id") != tenant_id
            or memory.get("agent_id") != agent_id
            or (memory.get("metadata") or {}).get("tenant_id") != tenant_id
        ):
            return False
        self._memory.delete(memory_id)
        self._invalidate_tenant_cache(tenant_id)
        return True

    def purge_tenant(self, tenant_id: str) -> None:
        self._memory.delete_all(user_id=tenant_id)
        self._invalidate_tenant_cache(tenant_id)

    def prune_stale_memories(self, tenant_id: str, agent_id: str | None = None) -> int:
        """Delete this tenant's memories older than the configured retention window."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=self._retention_days)
        stale_ids: list[str] = []
        filters = {"user_id": tenant_id, "tenant_id": tenant_id}
        if agent_id is not None:
            filters["agent_id"] = agent_id
        items = _memories_from_result(
            self._memory.get_all(filters=filters, top_k=10_000)
        )
        for item in items:
            created_at = _parse_datetime(item.get("created_at"))
            metadata = item.get("metadata") or {}
            if (
                created_at is not None
                and created_at < cutoff
                and metadata.get("tenant_id") == tenant_id
                and (agent_id is None or item.get("agent_id") == agent_id)
                and item.get("id") is not None
            ):
                stale_ids.append(str(item["id"]))

        for memory_id in stale_ids:
            self._memory.delete(memory_id)
        if stale_ids:
            self._invalidate_tenant_cache(tenant_id)
        return len(stale_ids)

    def _cache_key(self, tenant_id: str, agent_id: str, query: str, limit: int) -> str:
        if self._cache is None:
            return ""
        tenant_hash = _tenant_digest(tenant_id)
        agent_hash = _tenant_digest(agent_id)
        version = self._cache_get_version(tenant_id)
        query_hash = hashlib.sha256(
            json.dumps(
                [agent_id, query.strip(), limit, self._similarity_threshold],
                ensure_ascii=True,
            ).encode("utf-8")
        ).hexdigest()
        return f"memcache:{tenant_hash}:{agent_hash}:{version}:{query_hash}"

    def _cache_get_version(self, tenant_id: str) -> int:
        if self._cache is None:
            return 0
        try:
            value = self._cache.get(f"memcache:version:{_tenant_digest(tenant_id)}")
            return int(value or 0)
        except (ValueError, TypeError):
            logger.warning("Memory cache version was invalid; using generation zero")
            return 0
        except RedisError as exc:
            self._log_cache_failure("read version", exc)
            return 0

    def _cache_get(self, key: str) -> list[dict[str, Any]] | None:
        if self._cache is None:
            return None
        try:
            value = self._cache.get(key)
            if value is None:
                return None
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else None
        except (ValueError, TypeError, json.JSONDecodeError):
            logger.warning("Ignoring invalid Memory Service cache entry")
            return None
        except RedisError as exc:
            self._log_cache_failure("read", exc)
            return None

    def _cache_set(self, key: str, memories: list[dict[str, Any]]) -> None:
        if self._cache is None:
            return
        try:
            self._cache.setex(key, self._cache_ttl_seconds, json.dumps(memories))
        except RedisError as exc:
            self._log_cache_failure("write", exc)

    def _invalidate_tenant_cache(self, tenant_id: str) -> None:
        if self._cache is None:
            return
        try:
            self._cache.incr(f"memcache:version:{_tenant_digest(tenant_id)}")
        except RedisError as exc:
            self._log_cache_failure("invalidate", exc)

    @staticmethod
    def _log_cache_failure(operation: str, exc: Exception) -> None:
        logger.warning("Memory cache %s failed; continuing without cache: %s", operation, exc)
