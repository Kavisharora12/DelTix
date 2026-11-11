# =============================================================================
# DELTIX — Python LangGraph Runtime Worker Dockerfile (:8085)
# Multi-stage optimized build: compiles wheels in builder, leaves compilers behind
# =============================================================================

# --- Stage 1: Build & install dependencies ---
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/agent-runtime-service/worker/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Minimal runtime image ---
FROM python:3.12-slim AS runner

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install curl for container healthcheck and create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 deltix

# Copy pre-built packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source code
COPY backend/agent-runtime-service/worker/ .

RUN chown -R deltix:deltix /app

USER deltix

EXPOSE 8085

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD curl -f http://localhost:8085/healthz || exit 1

ENTRYPOINT ["python", "main.py"]
