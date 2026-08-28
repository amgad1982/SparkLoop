# SparkLoop - Production Deployment Guide (HOWTO)

This document provides complete instructions for deploying the **SparkLoop** platform to production using Docker Compose and Cloudflare Tunnel.

---

## 1. System Architecture Overview

SparkLoop is split into two independent Docker Compose stacks joined by a shared internal network (`sparkloop-net`):

1. **Infrastructure Stack (`docker-compose.infra.prod.yml`)**:
   - **PostgreSQL 17**: Core relational database (Internal only).
   - **Redis 7**: L2 caching, session management, and FusionCache backplane (Internal only).
   - **MinIO**: S3-compatible object storage for meme media, audio recordings, and avatars.
   - **Centrifugo v5**: High-performance real-time WebSocket server for live updates, voting counters, and chat.
   - **LiveKit SFU**: Real-time WebRTC audio server for Mood Pod voice stages.

2. **Application Stack (`docker-compose.app.yml`)**:
   - **Backend API**: .NET 10 ASP.NET Web API (Multi-stage Alpine container).
   - **Frontend Web**: React 18 + Vite + TailwindCSS served via Nginx Alpine.

```
                     ┌────────────────────────────────────────────────────────┐
                     │                 Cloudflare Edge & Tunnel                │
                     └───────┬────────────┬───────────┬────────────┬──────────┘
                             │            │           │            │
     ┌───────────────────────┼────────────┼───────────┼────────────┼───────────────────────┐
     │ Host Machine          │            │           │            │                       │
     │                       ▼            ▼           ▼            ▼                       │
     │                 :7070 (HTTP)  :5000 (HTTP) :8000 (WS)  :9000 (HTTP)                 │
     │                      │            │           │            │                        │
     │  ┌───────────────────┼────────────┼───────────┴────────────┼─────────────────────┐  │
     │  │ Docker Bridge     │            │                        │                     │  │
     │  │ (sparkloop-net)   ▼            ▼                        ▼                     │  │
     │  │              ┌─────────┐  ┌─────────┐              ┌─────────┐                │  │
     │  │              │Frontend │  │ Backend │              │  MinIO  │                │  │
     │  │              │ (Nginx) │  │(.NET 10)│              │ Storage │                │  │
     │  │              └─────────┘  └────┬────┘              └─────────┘                │  │
     │  │                                │                                              │  │
     │  │                 ┌──────────────┼──────────────┐                               │  │
     │  │                 ▼              ▼              ▼                               │  │
     │  │            ┌──────────┐  ┌───────────┐  ┌───────────┐                         │  │
     │  │            │PostgreSQL│  │   Redis   │  │Centrifugo │                         │  │
     │  │            │(Internal)│  │(Internal) │  │  (Realtime│                         │  │
     │  │            └──────────┘  └───────────┘  └───────────┘                         │  │
     │  │                                               │                               │  │
     │  │                                               ▼                               │  │
     │  │                                         ┌───────────┐                         │  │
     │  │                                         │  LiveKit  │◀─── UDP 50000-50050     │  │
     │  │                                         │(Voice SFU)│     (WebRTC Audio)      │  │
     │  │                                         └───────────┘                         │  │
     │  └───────────────────────────────────────────────────────────────────────────────┘  │
     └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Domain & Subdomain Mapping

| Subdomain | Target Container Port | Protocol | Purpose |
|---|---|:---:|---|
| **`sloop.mydev-lab.com`** | `http://localhost:7070` | HTTPS | React Web App UI (Nginx) |
| **`sloopapi.mydev-lab.com`** | `http://localhost:5000` | HTTPS | .NET 10 REST API & Swagger |
| **`sloopws.mydev-lab.com`** | `http://localhost:8000` | WSS | Centrifugo WebSockets (Live updates & chat) |
| **`sloopmedia.mydev-lab.com`** | `http://localhost:9000` | HTTPS | MinIO S3 Public Media CDN |
| **`slooplive.mydev-lab.com`** | `http://localhost:7880` | WSS | LiveKit WebRTC Signaling |

---

## 3. Cloudflare Configuration

### A. Cloudflare Tunnel Ingress Rules (`cloudflared`)

Configure your Cloudflare Tunnel (either via Cloudflare Zero Trust Dashboard $\rightarrow$ **Networks** $\rightarrow$ **Tunnels** or via your `config.yml` file):

```yaml
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: /etc/cloudflared/<YOUR-TUNNEL-UUID>.json

ingress:
  # 1. Frontend Web App
  - hostname: sloop.mydev-lab.com
    service: http://localhost:7070

  # 2. Backend REST API
  - hostname: sloopapi.mydev-lab.com
    service: http://localhost:5000

  # 3. Centrifugo WebSockets
  - hostname: sloopws.mydev-lab.com
    service: http://localhost:8000

  # 4. MinIO Public Media Storage
  - hostname: sloopmedia.mydev-lab.com
    service: http://localhost:9000

  # 5. LiveKit Voice Signaling
  - hostname: slooplive.mydev-lab.com
    service: http://localhost:7880

  # Catch-all
  - service: http_status:404
```

### B. Essential Cloudflare Dashboard Settings

1. **Enable WebSockets**:
   - Navigate to **Network** $\rightarrow$ Ensure **WebSockets** is toggled to **ON**.
2. **Increase Maximum Upload Size**:
   - Ensure the request body size allows at least **15 MB** for meme image and audio uploads (Cloudflare Free tier default is 100 MB).
3. **Disable Rocket Loader for API & WebSockets**:
   - Navigate to **Speed** $\rightarrow$ **Optimization** $\rightarrow$ Ensure Rocket Loader is **Disabled** or excluded for `sloopapi.mydev-lab.com` and `sloopws.mydev-lab.com`.
4. **WebRTC Media (LiveKit Voice Streaming)**:
   - Cloudflare HTTP Tunnels route TCP/HTTP/WS traffic. Standard WebRTC voice audio packets use **UDP**.
   - In your host/router firewall, forward **UDP ports `50000-50050`** to your host server.

---

## 4. Production Deployment Step-by-Step

### Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- `cloudflared` installed and authenticated
- Git repository cloned to your server

### Step 1: Prepare Environment Variables
Create a `.env` file in the root directory (optional overrides):

```bash
# Database Credentials
POSTGRES_DB=sparkloop
POSTGRES_USER=sparkuser
POSTGRES_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE

# Real-time Keys
CENTRIFUGO_SECRET=YOUR_CENTRIFUGO_SECRET_KEY
LIVEKIT_API_KEY=sparkloop_livekit_key
LIVEKIT_API_SECRET=YOUR_32_CHAR_LIVEKIT_SECRET
```

### Step 2: Start Infrastructure Stack
Launch the isolated production infrastructure:

```bash
docker compose -f docker-compose.infra.prod.yml up -d
```

Verify all infrastructure containers are running and healthy:
```bash
docker compose -f docker-compose.infra.prod.yml ps
```

### Step 3: Build & Launch Application Stack
Build the optimized .NET 10 and React/Vite containers and launch:

```bash
docker compose -f docker-compose.app.yml up -d --build
```

Verify application containers:
```bash
docker compose -f docker-compose.app.yml ps
```

### Step 4: Verify Health Probes
```bash
# Backend API Health Check
curl -I http://localhost:5000/health

# Frontend Health Check
curl -I http://localhost:7070/health

# Centrifugo Health Check
curl -I http://localhost:8000/health

# LiveKit Health Check
curl -I http://localhost:7880/
```

---

## 5. Security & Port Exposure Reference

| Container | Host Port | Exposure | Notes |
|---|:---:|:---:|---|
| `sparkloop-postgres` | *None* | 🔒 Closed | Connected only via internal Docker network `sparkloop-net` |
| `sparkloop-redis` | *None* | 🔒 Closed | Connected only via internal Docker network `sparkloop-net` |
| `sparkloop-minio` | `127.0.0.1:9000` |  Loopback | Proxied to `sloopmedia.mydev-lab.com` via Cloudflare Tunnel |
| `sparkloop-centrifugo` | `127.0.0.1:8000` |  Loopback | Proxied to `sloopws.mydev-lab.com` via Cloudflare Tunnel |
| `sparkloop-livekit` | `127.0.0.1:7880`<br/>`50000-50050/udp` |  Loopback<br/>🌐 UDP Host | Signaling via Cloudflare Tunnel; Audio streams over UDP |
| `sparkloop-backend` | `5000` |  Host Port | Proxied to `sloopapi.mydev-lab.com` via Cloudflare Tunnel |
| `sparkloop-frontend` | `7070` |  Host Port | Proxied to `sloop.mydev-lab.com` via Cloudflare Tunnel |

---

## 6. Useful Maintenance Commands

```bash
# View live logs for Backend API
docker logs -f sparkloop-backend

# View live logs for Real-time Centrifugo
docker logs -f sparkloop-centrifugo

# View live logs for LiveKit Audio Rooms
docker logs -f sparkloop-livekit

# Rolling Restart for Backend API
docker compose -f docker-compose.app.yml restart sparkloop-backend

# Rebuild Frontend after UI code update
docker compose -f docker-compose.app.yml up -d --build sparkloop-frontend

# Stop All Services Gracefully
docker compose -f docker-compose.app.yml down
docker compose -f docker-compose.infra.prod.yml down
```
