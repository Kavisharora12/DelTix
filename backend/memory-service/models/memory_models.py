"""Pydantic contracts for the internal Memory Service API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


Identifier = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=200,
        pattern=r"^\S+$",
    ),
]


class MemoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["system", "user", "assistant"]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20_000)]


class StoreMemoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: Identifier
    agent_id: Identifier
    messages: list[MemoryMessage] = Field(min_length=1, max_length=100)


class RetrieveMemoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: Identifier
    agent_id: Identifier
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]
    limit: int | None = Field(default=None, ge=1, le=100)


class PruneMemoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: Identifier
    agent_id: Identifier | None = None


class MemoryItem(BaseModel):
    id: str
    text: str
    score: float | None = None
    created_at: datetime | None = None


class MemoryListResponse(BaseModel):
    memories: list[MemoryItem]


class StoreMemoryResponse(BaseModel):
    memories: list[MemoryItem] = Field(default_factory=list)


class DeleteMemoryResponse(BaseModel):
    deleted: bool


class PurgeMemoryResponse(BaseModel):
    deleted: bool


class PruneMemoryResponse(BaseModel):
    deleted_count: int
