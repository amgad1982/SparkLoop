# SparkLoop (شبكة تدوين مصغر ترفيهية وتفاعلية) ✨

SparkLoop is a production-grade social micro-blogging and interactive entertainment platform combining **Pass-the-Mic Story Chains**, **24h Synchronized Daily Sparks**, **Ephemeral Mood Pods**, and a **Touch-friendly Meme Canvas** with instant WebP export.

Built with **ASP.NET Core 10 (C# 14)** using **Domain-Driven Design (DDD)** and **CQRS (MediatR)**, **Centrifugo v5** for real-time WebSockets, **PostgreSQL 17**, **Redis 7**, **MinIO S3**, and a **React 19 / TypeScript / Vite** mobile-first frontend with full bidirectional **Arabic (RTL)** and **English (LTR)** support.

---

## 🚀 Key Features

1. **Micro-Posts & Meme Canvas Lab**:
   - Posts strictly $\le 280$ characters.
   - Touch-enabled HTML5 Canvas for drawing, draggable/scalable text overlays, and viral sticker trays.
   - Direct high-quality WebP image export before upload.

2. **Pass-the-Mic Story Chains**:
   - Collaborative micro-story loops (5, 10, or 20 step limits).
   - **Domain Invariant**: Turn lock policy prevents a user from submitting two consecutive turns.
   - Optimistic concurrency control (`RowVersion`) prevents race conditions on step additions.
   - Real-time step broadcast and completion confetti celebrations over Centrifugo.

3. **24h Synchronized Daily Sparks**:
   - Global daily creative challenge rotated automatically every 24 hours UTC by a background worker.
   - Real-time submission leaderboard and live upvote broadcasting.
   - Automatic winner resolution awarding the "Spark Champion" badge.

4. **24h Ephemeral Mood Pods**:
   - Real-time chat rooms with hard 24-hour TTL and automated cleanup.
   - Real-time presence counter and animated floating emoji reaction fountain bursts.

5. **Bidirectional English / Arabic Support**:
   - Seamless instant toggle between English (Inter font, LTR) and Arabic (Cairo font, RTL).
   - Built-in multi-persona switcher (Alice, Bob, Noor, Tariq) for effortless multi-user testing.

---

## 🛠️ Architecture & Tech Stack

```
SparkLoop/
├── docker-compose.yml       # PostgreSQL 17, Redis 7, Centrifugo v5, MinIO S3
├── centrifugo.json          # Centrifugo v5 JWT HMAC & channel namespace topology
├── backend/
│   ├── SparkLoop.slnx
│   └── src/
│       ├── SparkLoop.Domain/          # DDD Aggregates, ValueObjects, Domain Events, Invariants
│       ├── SparkLoop.Application/     # CQRS Commands & Queries, MediatR, Centrifugo handlers
│       ├── SparkLoop.Infrastructure/  # EF Core 10, Npgsql, StackExchange.Redis, AWS S3, Workers
│       └── SparkLoop.Api/             # ASP.NET Core 10 Web API, Middleware, Swagger, Seeding
│   └── tests/
│       └── SparkLoop.Domain.UnitTests/ # xUnit & FluentAssertions domain invariant tests
└── frontend/
    └── src/
        ├── components/      # MobileAppShell, MemeCanvasEditor, Chains, Sparks, MoodPods
        ├── hooks/           # useCentrifugo (Centrifuge JS v5 WebSocket hook)
        ├── stores/          # Zustand stores (Auth, Theme/RTL, Pods)
        └── services/        # API client & Centrifugo connector
```

---

## ⚡ Getting Started

### 1. Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/) & npm
- [Docker & Docker Compose](https://www.docker.com/)

### 2. Start Infrastructure Services
```bash
docker compose up -d
```
Starts:
- **PostgreSQL 17**: `localhost:5432`
- **Redis 7**: `localhost:6379`
- **Centrifugo v5**: `localhost:8000`
- **MinIO S3**: `localhost:9000` (Console at `:9001`)

### 3. Run the Backend API (.NET 10)
```bash
cd backend
dotnet run --project src/SparkLoop.Api/SparkLoop.Api.csproj
```
API & Swagger documentation will be available at `http://localhost:5000/swagger`.

### 4. Run the Frontend (React 19 / Vite)
```bash
cd frontend
npm install
npm run dev
```
Frontend will be available at `http://localhost:5173`.

### 5. Run Unit Tests
```bash
dotnet test backend/SparkLoop.slnx
```

---

## 📜 License
MIT License
