# =============================================================================
# DELTIX — Next.js Frontend Console Dockerfile (:3000)
# Multi-stage standalone build communicating with api-gateway over bridge network
# =============================================================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build Next.js standalone bundle ---
FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api/gateway
ARG NEXT_PUBLIC_APP_ENV=SANDBOX
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/public && npm run build

# --- Stage 3: Minimal production runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S deltix && adduser -S deltix -G deltix

COPY --from=builder --chown=deltix:deltix /app/public ./public
COPY --from=builder --chown=deltix:deltix /app/.next/standalone ./
COPY --from=builder --chown=deltix:deltix /app/.next/static ./.next/static

USER deltix

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
