"""HTTP handlers for the internal Memory Service API."""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Depends, Header, HTTPException, status

from config.config import load_memory_config_from_env
from models.memory_models import (
    DeleteMemoryResponse,
    MemoryListResponse,
    PruneMemoryRequest,
    PruneMemoryResponse,
    PurgeMemoryResponse,
    RetrieveMemoryRequest,
    StoreMemoryRequest,
    StoreMemoryResponse,
)
from services.memory_service import MemoryConfigurationError, MemoryService

router = APIRouter(prefix="/internal/v1/memory", tags=["memory"])


@lru_cache(maxsize=1)
def get_memory_service() -> MemoryService:
    """Create the configured Mem0 and Redis clients once per worker process."""
    try:
        return MemoryService.from_env()
    except MemoryConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def _validate_tenant_header(request_tenant: str, header_tenant: str) -> None:
    if request_tenant != header_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Tenant-ID must match the request tenant_id",
        )


@router.post("/retrieve", response_model=MemoryListResponse)
def retrieve_memories(
    request: RetrieveMemoryRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID", min_length=1),
    service: MemoryService = Depends(get_memory_service),
) -> MemoryListResponse:
    _validate_tenant_header(request.tenant_id, x_tenant_id)
    config = load_memory_config_from_env()
    if request.limit is not None and request.limit > config.max_limit:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"limit must be no greater than {config.max_limit}",
        )
    memories = service.retrieve(
        request.tenant_id, request.agent_id, request.query, request.limit
    )
    return MemoryListResponse(memories=memories)


@router.post("/store", response_model=StoreMemoryResponse)
def store_memories(
    request: StoreMemoryRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID", min_length=1),
    service: MemoryService = Depends(get_memory_service),
) -> StoreMemoryResponse:
    _validate_tenant_header(request.tenant_id, x_tenant_id)
    messages = [message.model_dump() for message in request.messages]
    return StoreMemoryResponse(
        memories=service.store(request.tenant_id, request.agent_id, messages)
    )


@router.delete("/{memory_id}", response_model=DeleteMemoryResponse)
def delete_memory(
    memory_id: str,
    agent_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID", min_length=1),
    service: MemoryService = Depends(get_memory_service),
) -> DeleteMemoryResponse:
    deleted = service.delete(x_tenant_id, agent_id, memory_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found for this tenant and agent",
        )
    return DeleteMemoryResponse(deleted=True)


@router.delete("/tenant/{tenant_id}", response_model=PurgeMemoryResponse)
def purge_tenant_memories(
    tenant_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID", min_length=1),
    service: MemoryService = Depends(get_memory_service),
) -> PurgeMemoryResponse:
    _validate_tenant_header(tenant_id, x_tenant_id)
    service.purge_tenant(tenant_id)
    return PurgeMemoryResponse(deleted=True)


@router.post("/prune", response_model=PruneMemoryResponse)
def prune_memories(
    request: PruneMemoryRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID", min_length=1),
    service: MemoryService = Depends(get_memory_service),
) -> PruneMemoryResponse:
    _validate_tenant_header(request.tenant_id, x_tenant_id)
    deleted_count = service.prune_stale_memories(request.tenant_id, request.agent_id)
    return PruneMemoryResponse(deleted_count=deleted_count)
