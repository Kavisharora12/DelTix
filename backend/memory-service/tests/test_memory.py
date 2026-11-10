"""Memory retrieval, redaction, API, cache, pruning, and tenant-isolation tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json

from fastapi.testclient import TestClient

from api.handlers import get_memory_service
from main import app
from services.memory_service import MemoryService, redact_pii


class FakeMemoryClient:
    def __init__(self) -> None:
        self.records: dict[str, dict] = {}
        self.next_id = 1

    def add(self, messages, *, user_id, agent_id, metadata):
        memory_id = f"memory-{self.next_id}"
        self.next_id += 1
        content = " ".join(message["content"] for message in messages)
        record = {
            "id": memory_id,
            "memory": content,
            "score": 0.9,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata,
            "user_id": user_id,
            "agent_id": agent_id,
        }
        self.records[memory_id] = record
        return {"results": [record]}

    def search(self, query, *, filters, top_k, threshold):
        records = [
            record
            for record in self.records.values()
            if all(
                record.get(key, record["metadata"].get(key)) == value
                for key, value in filters.items()
            )
            and query.lower() in record["memory"].lower()
            and record["score"] >= threshold
        ]
        return {"results": records[:top_k]}

    def get_all(self, *, filters=None, top_k=20):
        records = [
            record
            for record in self.records.values()
            if all(
                record.get(key, record["metadata"].get(key)) == value
                for key, value in (filters or {}).items()
            )
        ]
        return {"results": records[:top_k]}

    def get(self, memory_id):
        return self.records.get(memory_id)

    def delete(self, memory_id):
        self.records.pop(memory_id, None)

    def delete_all(self, *, user_id):
        self.records = {
            memory_id: record
            for memory_id, record in self.records.items()
            if record["user_id"] != user_id
        }


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def get(self, key):
        return self.values.get(key)

    def setex(self, key, ttl, value):
        self.values[key] = value

    def incr(self, key):
        value = int(self.values.get(key, "0")) + 1
        self.values[key] = str(value)
        return value


def build_service(*, retention_days: int = 90) -> tuple[MemoryService, FakeMemoryClient, FakeRedis]:
    memory = FakeMemoryClient()
    cache = FakeRedis()
    return (
        MemoryService(
            memory,
            cache,
            retention_days=retention_days,
            cache_ttl_seconds=60,
            default_limit=3,
            max_limit=5,
            similarity_threshold=0.70,
        ),
        memory,
        cache,
    )


def test_redacts_payment_card_cvv_and_token() -> None:
    source = "Card 4111 1111 1111 1111 cvv=123 payment_token=secret-token-value"

    redacted = redact_pii(source)

    assert "4111" not in redacted
    assert "123" not in redacted
    assert "secret-token-value" not in redacted
    assert "[REDACTED_CARD]" in redacted


def test_store_redacts_before_mem0_ingestion() -> None:
    service, memory, _ = build_service()

    stored = service.store(
        "tenant-a",
        "agent-a",
        [{"role": "user", "content": "My card is 4111 1111 1111 1111"}],
    )

    saved = next(iter(memory.records.values()))
    assert "4111" not in saved["memory"]
    assert stored[0].text == saved["memory"]
    assert saved["metadata"] == {"tenant_id": "tenant-a", "agent_id": "agent-a"}


def test_retrieval_is_scoped_to_tenant_and_agent() -> None:
    service, _, _ = build_service()
    service.store("tenant-a", "agent-a", [{"role": "user", "content": "weekly settlement preference"}])
    service.store("tenant-b", "agent-a", [{"role": "user", "content": "weekly settlement secret"}])
    service.store("tenant-a", "agent-b", [{"role": "user", "content": "weekly settlement other agent"}])

    result = service.retrieve("tenant-a", "agent-a", "weekly settlement")

    assert len(result) == 1
    assert result[0].text == "weekly settlement preference"
    assert service.retrieve("tenant-c", "agent-a", "weekly settlement") == []


def test_cache_is_scoped_and_invalidated_after_store() -> None:
    service, memory, cache = build_service()
    service.store("tenant-a", "agent-a", [{"role": "user", "content": "first preference"}])

    first = service.retrieve("tenant-a", "agent-a", "preference")
    cache_entries_before = len([key for key in cache.values if key.startswith("memcache:")])
    second = service.retrieve("tenant-a", "agent-a", "preference")
    assert first == second
    assert len(memory.records) == 1
    assert cache_entries_before >= 1

    service.store("tenant-a", "agent-a", [{"role": "user", "content": "second preference"}])
    refreshed = service.retrieve("tenant-a", "agent-a", "preference")
    assert len(refreshed) == 2


def test_delete_and_tenant_purge_do_not_touch_other_tenants() -> None:
    service, memory, _ = build_service()
    tenant_a_item = service.store(
        "tenant-a", "agent-a", [{"role": "user", "content": "tenant a memory"}]
    )[0]
    service.store("tenant-b", "agent-a", [{"role": "user", "content": "tenant b memory"}])

    assert service.delete("tenant-b", "agent-a", tenant_a_item.id) is False
    assert tenant_a_item.id in memory.records
    service.purge_tenant("tenant-a")
    assert tenant_a_item.id not in memory.records
    assert all(record["user_id"] == "tenant-b" for record in memory.records.values())


def test_prunes_only_stale_memories_in_requested_scope() -> None:
    service, memory, _ = build_service(retention_days=90)
    service.store("tenant-a", "agent-a", [{"role": "user", "content": "old memory"}])
    old_record = next(iter(memory.records.values()))
    old_record["created_at"] = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
    service.store("tenant-a", "agent-b", [{"role": "user", "content": "other agent old memory"}])
    other_agent = list(memory.records.values())[1]
    other_agent["created_at"] = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
    service.store("tenant-b", "agent-a", [{"role": "user", "content": "other tenant old memory"}])
    other_tenant = list(memory.records.values())[2]
    other_tenant["created_at"] = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()

    assert service.prune_stale_memories("tenant-a", "agent-a") == 1
    assert old_record["id"] not in memory.records
    assert other_agent["id"] in memory.records
    assert other_tenant["id"] in memory.records


def test_http_api_requires_matching_tenant_header() -> None:
    service, _, _ = build_service()
    app.dependency_overrides[get_memory_service] = lambda: service
    try:
        client = TestClient(app)
        response = client.post(
            "/internal/v1/memory/retrieve",
            headers={"X-Tenant-ID": "tenant-b"},
            json={
                "tenant_id": "tenant-a",
                "agent_id": "agent-a",
                "query": "anything",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert json.loads(response.text)["detail"] == "X-Tenant-ID must match the request tenant_id"


def test_http_api_stores_and_retrieves_scoped_memories() -> None:
    service, _, _ = build_service()
    app.dependency_overrides[get_memory_service] = lambda: service
    try:
        client = TestClient(app)
        headers = {"X-Tenant-ID": "tenant-a"}
        health = client.get("/healthz")
        store = client.post(
            "/internal/v1/memory/store",
            headers=headers,
            json={
                "tenant_id": "tenant-a",
                "agent_id": "agent-a",
                "messages": [{"role": "user", "content": "Prefers weekly settlement reports"}],
            },
        )
        retrieve = client.post(
            "/internal/v1/memory/retrieve",
            headers=headers,
            json={
                "tenant_id": "tenant-a",
                "agent_id": "agent-a",
                "query": "weekly settlement",
                "limit": 3,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert health.status_code == 200
    assert store.status_code == 200
    assert retrieve.status_code == 200
    assert retrieve.json()["memories"][0]["text"] == "Prefers weekly settlement reports"
