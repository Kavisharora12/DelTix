# DelTix Production DevOps & Cloud Deployment Guide

This guide details the complete production architecture, provisioning steps, networking topology, and zero-downtime deployment workflows for **DelTix**.

---

## 1. High-Level Architecture Topology

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT TIER                           │
│  Browser / Mobile (Chrome, Safari, Edge, Firefox)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                HTTPS / WSS    │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK                      │
│  DelTix Next.js 14 Frontend Console                         │
│  - Edge SSR & Static Assets                                 │
│  - Environment: NEXT_PUBLIC_API_URL=https://api.deltix.io   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               REST / SSE      │  HTTPS :443
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AWS EC2 / DOCKER SWARM CLUSTER              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Reverse Proxy: Caddy / Nginx (SSL Termination :443)   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ Ingress: API Gateway (:8080)                          │  │
│  └───────┬──────────────┬──────────────┬─────────────┬───┘  │
│          │              │              │             │      │
│  ┌───────▼───────┐┌─────▼───────┐┌─────▼──────┐┌─────▼───┐  │
│  │ Compiler :8081││ Runtime :8082││Policy :8084││Memory :8083  │
│  └───────────────┘└─────┬───────┘└────────────┘└─────────┘  │
│                         │                                   │
│                  ┌──────▼────────┐                          │
│                  │ Worker :8085  │ (LangGraph Engine)       │
│                  └───────────────┘                          │
│                                                             │
│  Overlay Network: deltix-overlay (Driver: overlay)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
          Pooler IPv4 Port 6543│
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRESQL                      │
│  Supavisor Connection Pooler (aws-0-<region>.pooler...)     │
│  - ACID State, Checkpoints, Capabilities & Approvals        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase IPv6 vs. IPv4 Connection Pooler (Critical EC2 Caveat)

### The IPv6 EC2 Trap
By default:
1. **Supabase Direct DB (`db.<ref>.supabase.co:5432`)**: Resolves exclusively to **IPv6** addresses on standard projects.
2. **AWS EC2 Subnets**: Standard AWS VPC subnets and default security groups are **IPv4-only**.
3. If an EC2 container attempts to connect directly to `db.<ref>.supabase.co:5432`, the connection will fail with:
   ```
   dial tcp: lookup db.<ref>.supabase.co: no such host
   # OR
   connect: no route to host / network unreachable
   ```

### The Production Solution: Supavisor Pooler over IPv4
Supabase provides an official **Supavisor Connection Pooler** with full **IPv4** routing.

| Connection Type | Endpoint Example | Port | Protocol Support | Recommended For |
|---|---|---|---|---|
| **Supavisor Pooler (Transaction)** | `aws-0-<region>.pooler.supabase.com` | `6543` | **IPv4 & IPv6** | **All EC2 Microservices (Fast & Pooled)** |
| **Supavisor Pooler (Session)** | `aws-0-<region>.pooler.supabase.com` | `5432` | **IPv4 & IPv6** | Migrations & Prepared Statements |
| **Direct Database Connection** | `db.<ref>.supabase.co` | `5432` | **IPv6 Only** (Unless $10/mo IPv4 Addon) | Not recommended for default EC2 |

### Production Connection String
In your EC2 `.env`:
```bash
# Correct: Connect through IPv4 Supavisor Pooler (Port 6543 for pooling)
SUPABASE_DB_URL=postgresql://postgres.<project_ref>:<db_password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

### Verification Command on EC2
Run this on your EC2 instance to verify IPv4 resolution before launching containers:
```bash
# Must return an IPv4 'A' record:
nslookup aws-0-ap-northeast-2.pooler.supabase.com

# Test TCP socket reachability on pooler port 6543:
nc -zv -w5 aws-0-ap-northeast-2.pooler.supabase.com 6543
```

---

## 3. Docker Networking: Bridge vs. Docker Swarm Overlay

### Why `bridge` Breaks in Docker Swarm
- `driver: bridge`: Creates an isolated Linux bridge on a **single host**. Only containers running via standard `docker compose up` on the same machine can communicate.
- `driver: overlay`: Required for **Docker Swarm** (`docker stack deploy`). It enables:
  - Multi-host cross-node encrypted mesh routing.
  - Native Swarm Service Discovery via internal DNS VIPs (e.g., `http://agent-runtime-service:8082`).
  - Automatic load balancing across replicated tasks.

### Swarm Network Definition
In your production `docker-stack.yml`, define the network with `driver: overlay` and `attachable: true`:
```yaml
networks:
  deltix-overlay:
    driver: overlay
    attachable: true
    ipam:
      driver: default
      config:
        - subnet: 10.11.0.0/16
```

---

## 4. Production Docker Swarm Stack (`docker-stack.yml`)

Save this file as `docker-stack.yml` on your EC2 deployment instance:

```yaml
version: "3.8"

services:
  # ---------------------------------------------------------------------------
  # 1. API Gateway (:8080) — Public Reverse Proxy
  # ---------------------------------------------------------------------------
  api-gateway:
    image: ${DOCKER_REGISTRY}/deltix-api-gateway:${TAG:-latest}
    ports:
      - target: 8080
        published: 8080
        protocol: tcp
        mode: ingress
    environment:
      - PORT=8080
      - FRONTEND_URL=${FRONTEND_URL}
      - COMPILER_SERVICE_URL=http://agent-compiler-service:8081
      - RUNTIME_SERVICE_URL=http://agent-runtime-service:8082
      - CAPABILITY_POLICY_SERVICE_URL=http://capability-policy-service:8084
      - MEMORY_SERVICE_URL=http://memory-service:8083
      - SUPABASE_DB_URL=${SUPABASE_DB_URL}
      - GATEWAY_JWT_SECRET=${GATEWAY_JWT_SECRET}
      - GATEWAY_ALLOW_DEV_AUTH=${GATEWAY_ALLOW_DEV_AUTH:-false}
    networks:
      - deltix-overlay
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback

  # ---------------------------------------------------------------------------
  # 2. Agent Compiler Service (:8081)
  # ---------------------------------------------------------------------------
  agent-compiler-service:
    image: ${DOCKER_REGISTRY}/deltix-agent-compiler-service:${TAG:-latest}
    environment:
      - PORT=8081
      - SUPABASE_DB_URL=${SUPABASE_DB_URL}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_PRIMARY_MODEL=${GEMINI_PRIMARY_MODEL:-gemini-2.5-flash}
      - GEMINI_FALLBACK_MODEL=${GEMINI_FALLBACK_MODEL:-gemini-2.0-flash}
      - MEMORY_SERVICE_URL=http://memory-service:8083
      - CAPABILITY_POLICY_SERVICE_URL=http://capability-policy-service:8084
    networks:
      - deltix-overlay
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

  # ---------------------------------------------------------------------------
  # 3. Agent Runtime Service (:8082)
  # ---------------------------------------------------------------------------
  agent-runtime-service:
    image: ${DOCKER_REGISTRY}/deltix-agent-runtime-service:${TAG:-latest}
    environment:
      - PORT=8082
      - SUPABASE_DB_URL=${SUPABASE_DB_URL}
      - REDIS_URL=${REDIS_URL}
      - WORKER_BRIDGE_URL=http://agent-runtime-worker:8085
      - READINESS_HMAC_SECRET=${READINESS_HMAC_SECRET}
    networks:
      - deltix-overlay
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s

  # ---------------------------------------------------------------------------
  # 4. Agent Runtime Worker (:8085) — LangGraph Python Engine
  # ---------------------------------------------------------------------------
  agent-runtime-worker:
    image: ${DOCKER_REGISTRY}/deltix-agent-runtime-worker:${TAG:-latest}
    environment:
      - PORT=8085
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MEMORY_SERVICE_URL=http://memory-service:8083
      - CAPABILITY_POLICY_SERVICE_URL=http://capability-policy-service:8084
      - PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}
      - PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}
      - PAYPAL_ENVIRONMENT=${PAYPAL_ENVIRONMENT:-sandbox}
    networks:
      - deltix-overlay
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1024M
        reservations:
          memory: 512M

  # ---------------------------------------------------------------------------
  # 5. Capability & Policy Service (:8084)
  # ---------------------------------------------------------------------------
  capability-policy-service:
    image: ${DOCKER_REGISTRY}/deltix-capability-policy-service:${TAG:-latest}
    environment:
      - PORT=8084
      - SUPABASE_DB_URL=${SUPABASE_DB_URL}
      - RUNTIME_SERVICE_URL=http://agent-runtime-service:8082
      - APPROVAL_HMAC_SECRET=${APPROVAL_HMAC_SECRET}
      - PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}
      - PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}
      - PAYPAL_ENVIRONMENT=${PAYPAL_ENVIRONMENT:-sandbox}
    networks:
      - deltix-overlay
    deploy:
      replicas: 1

  # ---------------------------------------------------------------------------
  # 6. Memory Service (:8083) — Chroma & Semantic Vectors
  # ---------------------------------------------------------------------------
  memory-service:
    image: ${DOCKER_REGISTRY}/deltix-memory-service:${TAG:-latest}
    environment:
      - PORT=8083
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MEMORY_CHROMA_PERSIST_DIR=/data/chroma
    volumes:
      - memory-data:/data/chroma
    networks:
      - deltix-overlay
    deploy:
      replicas: 1

networks:
  deltix-overlay:
    driver: overlay
    attachable: true

volumes:
  memory-data:
    driver: local
```

---

## 5. Step-by-Step AWS EC2 Provisioning

### 1. Launch Instance
- **AMI**: Ubuntu Server 24.04 LTS (HVM), SSD Volume Type
- **Instance Type**: `t3.medium` (Minimum: 2 vCPU, 4GB RAM) or `t3.large`
- **Storage**: 30 GB gp3 SSD
- **Security Group Inbound Rules**:
  - `SSH` (Port 22) -> Your Admin IP
  - `HTTP` (Port 80) -> `0.0.0.0/0` (For Let's Encrypt SSL challenge)
  - `HTTPS` (Port 443) -> `0.0.0.0/0` (Production traffic)
  - `Custom TCP` (Port 8080) -> `0.0.0.0/0` (Or restrict to Cloudflare / Vercel IPs)

### 2. Install Docker & Initialize Swarm
SSH into the EC2 instance:
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Install Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# Initialize Docker Swarm (Single Node Manager)
docker swarm init --advertise-addr $(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
```

### 3. Deploy SSL Reverse Proxy (Caddy or Nginx)
To provide automatic TLS 1.3 certificates and proxy traffic to API Gateway (:8080):

Create `/opt/caddy/Caddyfile`:
```caddyfile
api.yourdomain.com {
    reverse_proxy localhost:8080 {
        header_up X-Forwarded-Proto https
        header_up Host {host}
    }
}
```
Run Caddy:
```bash
docker run -d \
  --name caddy-ssl \
  --restart always \
  --net host \
  -v /opt/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  caddy:2.8-alpine
```

---

## 6. Frontend Deployment on Vercel

### 1. Import Repository
1. Navigate to [vercel.com](https://vercel.com) and click **Add New > Project**.
2. Select your `DelTix` repository.
3. Configure the Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`

### 2. Environment Variables in Vercel Dashboard
Add the following under **Settings > Environment Variables**:

| Variable Name | Production Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Public URL of your EC2 API Gateway |
| `NEXT_PUBLIC_APP_ENV` | `SANDBOX` (or `LIVE`) | Default environment mode |
| `API_GATEWAY_INTERNAL_URL` | `https://api.yourdomain.com` | Server-side fallback proxy |
| `NEXT_PUBLIC_ALLOW_DEV_AUTH` | `false` | Disable mock dev auth in production |

### 3. CORS Configuration on Backend
Ensure your backend `.env` on EC2 allows the Vercel domain:
```bash
FRONTEND_URL=https://deltix-console.vercel.app
```

---

## 7. CI/CD & Zero-Downtime Deployment Command

To deploy or update services without dropping connections:

```bash
# 1. Export deployment environment
export DOCKER_REGISTRY="ghcr.io/yourorg"
export TAG="$(git rev-parse --short HEAD)"

# 2. Deploy or update stack
docker stack deploy -c docker-stack.yml deltix --with-registry-auth

# 3. Verify running Swarm services
docker service ls
docker service ps deltix_api-gateway
```

### Checking Service Logs in Swarm
```bash
# Stream API Gateway logs
docker service logs -f deltix_api-gateway

# Stream LangGraph Python Worker logs
docker service logs -f deltix_agent-runtime-worker
```
