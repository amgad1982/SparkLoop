# SparkLoop — Future Engineering Roadmap
## Deferred items from the architecture / scalability review

> **Status:** Snapshot taken after the "Now tier" was implemented (security
> fixes, rate limiting, OpenTelemetry, keyset feed pagination, leader-elected
> background workers, PgBouncer, secret validation, Centrifugo hardening).
> The full architectural review is in `SCALE_TO_MILLIONS_PLAN.md`; this file
> lists the **remaining work** in prioritised order, with concrete acceptance
> criteria and a recommended execution order.

---

## Reading guide

| Symbol | Meaning |
|---|---|
| 🔴 **P0** | Drops requests / corrupts state / is a security hole. Ship within the current sprint. |
| 🟠 **P1** | Real bottleneck once concurrent users cross ~10 k. Ship in the next 1–2 sprints. |
| 🟡 **P2** | Required to reach the C10M target in `SCALE_TO_MILLIONS_PLAN.md`. Ship in the next quarter. |
| ⚪ **P3** | Nice-to-have / polish. Backlog. |

Effort is sized for a single engineer:

- **S** = ≤ 1 day
- **M** = 2–5 days
- **L** = 1–2 weeks
- **XL** = ≥ 2 weeks (usually needs design + spike)

---

## 0. Quick wins before anything else

These do not show up in the original roadmap but were surfaced during the audit:

| # | Item | Priority | Effort | Status | Notes |
|---|------|----------|--------|--------|-------|
| 0.1 | Replace `localhost` hard-coded Centrifugo / MinIO / LiveKit secret defaults with a startup assertion that throws in Production | P2 | S | done | Tracked in `SecretValidation.cs`; verify the docker-compose secrets match before declaring complete. |
| 0.2 | Move `JwtSettings` into `IConfiguration` only, fail-fast on missing key in Production | P2 | S | done | Today the API falls back to `"sparkloop_…_super_secure"` in any environment. Verify the prod compose files inject the real key. |
| 0.3 | Add `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy` response headers | P1 | S | partial | HSTS already set in non-Development. CSP + Permissions-Policy still missing. |
| 0.4 | Disable `Allow-Origin: *` and `AllowCredentials: true` simultaneously on Centrifugo | P0 | S | done | Wildcard origin removed. |
| 0.5 | Block client publish on `pod:*` and `user:*` namespaces | P0 | S | done | `pod` set to `false`; verify on staging that all existing flows still work. |


---

## 1. Throughput and latency — the "Next" tier

Goal: keep API P99 under 60 ms for writes and under 25 ms for reads at 10 k concurrent users.

### 1.1 Outbox table + async Centrifugo publisher — P1, L

The single highest-leverage change that remains. Today every domain event triggers a synchronous `HTTP POST /api/publish` inside the EF Core `SaveChangesAsync` path. At viral scale the API thread is held for the duration of that round-trip.

Plan:

1. Add a `domain_event_outbox` table:
   ```sql
   CREATE TABLE domain_event_outbox (
       id            UUID PRIMARY KEY,
       occurred_on   TIMESTAMPTZ NOT NULL,
       event_type    TEXT NOT NULL,
       aggregate_id  UUID NOT NULL,
       channel       TEXT NOT NULL,
       payload       JSONB NOT NULL,
       processed_at  TIMESTAMPTZ NULL,
       attempts      INT NOT NULL DEFAULT 0,
       last_error    TEXT NULL,
       INDEX idx_outbox_unprocessed (processed_at, occurred_on)
   );
   ```
2. In `AppDbContext.SaveChangesAsync`, when a domain event is collected, insert a row into the outbox in the same transaction.
3. Add `OutboxPublisherWorker : BackgroundService` (uses the existing `PostgresAdvisoryLock` so only one replica drains) that:
   - Selects up to N unprocessed rows (`FOR UPDATE SKIP LOCKED`).
   - Calls `ICentrifugoService.PublishAsync(channel, payload)`.
   - On success marks `processed_at = now()`. On failure increments `attempts` and logs `last_error`.
4. After migration and cut-over, delete the inline `_centrifugoService.PublishAsync(...)` calls from `CentrifugoDomainEventHandlers` (they become dead code).
5. Add metrics: `sparkloop_outbox_pending`, `sparkloop_outbox_publish_latency_seconds`, `sparkloop_outbox_publish_failures_total`.

Acceptance criteria:

- API P99 for `CreatePostCommand` drops by >= 30 percent under load.
- Killing Centrifugo no longer fails user-facing writes; backlog drains when Centrifugo returns.
- No event loss across API crashes (the row in the outbox survives).

### 1.2 Fan-out-on-write Redis timelines — P1, L

Replaces `GetFeedPostsQuery` with per-user Redis ZSETs populated by the outbox publisher. Required to scale read-heavy celebrity timelines.

Plan:

1. Add the `feed:inbox:{userId}` ZSET (score = `created_at_utc`, member = `post_id`), capped at 1 000 entries via `ZREMRANGEBYRANK`.
2. The outbox publisher, on every `PostCreatedEvent`, computes followers via `UserFollow` (paginated) and pushes the post id into each follower ZSET.
3. `GetFeedPostsQueryHandler` becomes:
   ```
   ids = ZREVRANGEBYSCORE feed:inbox:{userId} +inf -inf LIMIT pageSize
   SELECT ... FROM posts WHERE id = ANY(@ids)
   ```
   Replace the post-load with a single `WHERE Id = ANY(@ids)` query.
4. Eviction policy: when a post is deleted, walk followers and `ZREM` (or accept eventual drift and trim daily).
5. For private accounts, only push the id if the viewer is an accepted follower.

Acceptance criteria:

- Home feed retrieval P99 < 5 ms at the API layer when Redis is warm.
- Memory stays bounded (1 000 entries per user; plan for sharding once 1 M users are on the system).

### 1.3 Reaction and vote counters in Redis — P1, M

Today every reaction is a DB row plus a domain event plus a Centrifugo publish. At viral load that is the hot path.

Plan:

1. Redis hash `post:{id}:reactions` with field = reaction type, value = count. `HINCRBY` per reaction.
2. Redis set `post:{id}:reactors:{userId}` for uniqueness. `SISMEMBER` first; if member exists `SREM` and `HINCRBY -1`, else `SADD` and `HINCRBY 1`.
3. The outbox publisher debounces a `flush_post:{id}` event to write the final counts back to Postgres every N seconds (or on a memory-pressure signal).
4. `ReactToPostCommandHandler` becomes a single Redis pipeline (no Postgres writes on the hot path).
5. On startup, rebuild Redis from Postgres if the keys are missing (cold start).

Acceptance criteria:

- Hot-post reaction storm (10 k reactions per second) sustains on a single API replica.
- Counts converge to the same value as Postgres within the debounce window.

### 1.4 Hangfire for background jobs — P2, M

Replaces the ad-hoc `BackgroundService` workers with a proper job runner that gives free retries, a dashboard, observability, and dashboards for ops.

Plan:

1. Add `Hangfire.AspNetCore` plus `Hangfire.PostgreSql` packages.
2. Register the existing `PodTtlCleanerWorker` logic as `RecurringJob`s. (The SparkRotationWorker was removed when the daily Sparks feature was retired — see `DbInitializer` for the DROP TABLE migration.)
3. Expose the Hangfire dashboard behind `[Authorize(Roles = "Admin")]` (or `IConfiguration["Hangfire:AllowedUsers"]`).
4. Migrate `PodTtlCleanerWorker` away from the manual loop; keep the Postgres advisory lock for cross-replica safety even though Hangfire has its own leader election.
5. Move the outbox publisher (1.1) into Hangfire as well.

Acceptance criteria:

- Dashboard at `/hangfire` shows job history, retries, and DLQ.
- Killing a worker mid-job triggers automatic retry, no double-execution.

### 1.5 Meilisearch / OpenSearch for search — P2, L

`GET /api/search` currently runs `LIKE %term%` against Postgres. That falls off a cliff once corpus is large.

Plan:

1. Add a Meilisearch container to `docker-compose.infra.prod.yml`.
2. CDC pipeline: outbox events `PostCreatedEvent`, `UserUpdatedEvent`, `MoodPodCreatedEvent` to Meilisearch indexers.
3. Replace `SearchController` query with `ISearchService.SearchAsync(query, filters)` returning typed hits.
4. Frontend keeps the same DTO shape so no Flutter changes are needed.

Acceptance criteria:

- Search P99 < 15 ms at 10 M documents.
- Index lag < 2 s end-to-end.
---

## 2. Real-time and media

### 2.1 Presigned direct upload to MinIO — P1, M

`POST /api/media/upload` is currently 15 MB through the API. At viral load that exhausts ASP.NET request threads.

Plan:

1. New endpoint `POST /api/media/presign-upload` returning `{url, fields}` (MinIO `GetPreSignedURL`).
2. Mobile client `PUT`s the binary directly to MinIO.
3. Mobile then `POST`s the post metadata with the storage key; backend resolves key to URL.
4. Move the WebP / Opus transcoding to a background worker (subscribe to S3 notifications, run ffmpeg / sharp).
5. Switch MinIO bucket policy from `public-read` to private plus signed GET URLs.

Acceptance criteria:

- API request threads no longer count toward upload concurrency.
- Upload P99 < 200 ms for 10 MB files.

### 2.2 LiveKit distributed SFU plus TURN — P2, L

Required for media quality once more than 5 k concurrent voice users are on the system.

Plan:

1. Deploy LiveKit in distributed mode (Redis-backed routing).
2. Add a `coturn` container with TURN credentials minted by backend (`POST /api/pods/{id}/turn-credentials`).
3. Promote TURN over UDP (50000-50050/udp already exposed) and over TCP (443) for restrictive networks.
4. Mobile client: prefer LiveKit; fall back to base64 chunks only on TURN failure.

Acceptance criteria:

- ICE success rate on cellular networks greater than 95 percent (today ~70-85 percent).
- 100 concurrent pods times 10 speakers each run without packet loss.

### 2.3 Centrifugo cluster with Redis engine — P2, L

Single-node Centrifugo tops out around 60-100 k WebSockets. To serve millions we need a cluster.

Plan:

1. Replace the single Centrifugo service with N replicas in `docker-compose.infra.prod.yml`.
2. Configure `engine: redis` with the existing Redis cluster; horizontal scaling via consistent hashing on channel names.
3. Front the cluster with `sloopws.mydev-lab.com` (already in compose) and re-issue connection tokens with a per-replica shared secret.
4. Mobile: no change; the Centrifugo client transparently balances across nodes.

Acceptance criteria:

- 1 M concurrent WebSocket connections sustained across 4 replicas.
- Channel re-balancing on replica failure completes within 30 s.

### 2.4 Backpressure for pod reactions and sounds — P2, S

Currently `SendPodReaction`, `SendPodSoundEffect`, `SendPodBgMusic`, `SendPodSignal` each hit the API thread. At 50 users per pod times 5 actions per minute times N pods they waste throughput.

Plan:

1. Move these to the Centrifugo WebSocket itself: clients send to `pod:{id}` with a JSON payload, server-side Centrifugo RPC handler relays to all subscribers and persists only what needs to be persisted (e.g. a throttled aggregated reaction count).
2. Apply rate limiting at the Centrifugo RPC handler level (currently the API does that with `[EnableRateLimiting(RateLimitingPolicies.Reactions)]`).

Acceptance criteria:

- API request rate for pods drops by >= 70 percent.
- Reaction UI still feels real-time.



---

## 3. Database hardening

### 3.1 Postgres partitioning — P2, L

`posts`, `reactions`, `pod_messages` grow unbounded. Partition by month.

Plan:

1. Convert `posts` and `pod_messages` to `PARTITION BY RANGE (created_at_utc)`.
2. Pre-create partitions for the next 6 months.
3. Add `pg_partman` to auto-create new partitions.
4. Update the `(created_at_utc, id)` index on each partition.
5. Backfill historical data via `pg_partman`'s background worker.

Acceptance criteria:

- Old partitions can be detached for cold storage without locking the parent table.
- Query plans still use the local index on the active partition.

### 3.2 Sharded Postgres / read replicas — P1, M

Once a single primary saturates.

Plan:

1. Provision a streaming replica (`docker-compose.infra.prod.yml` with `postgres-replica`).
2. Configure EF Core read/write split via `IAppDbContext` reads to replica connection string, writes to primary.
3. Set `hot_standby_feedback = on` to avoid replication lag cancelling long queries.
4. Promote replica via `pg_ctl promote` for DR.

Acceptance criteria:

- Read-only queries (feed, search, profile) take <= 50 ms even during write bursts.
- Replica lag stays under 1 s under load.

### 3.3 Domain event idempotency keys — P2, S

When the outbox (1.1) ships, consumers may receive the same event twice (retries). Need an idempotency key per event.

Plan:

1. Add `EventId` (GUID) to every domain event.
2. Cache `processed_event_ids` in Redis with a 24 h TTL (`SET key value NX EX 86400`).
3. Event handlers check the cache and no-op on duplicates.

Acceptance criteria:

- Outbox publisher can safely retry the same row N times without double-emitting Centrifugo messages.



---

## 4. Observability and SLOs

### 4.1 OpenTelemetry tracing for EF Core and MediatR — P1, S

Today we instrument ASP.NET plus HttpClient; we still need EF Core and MediatR spans.

Plan:

1. Add `OpenTelemetry.Instrumentation.EntityFrameworkCore` (currently removed due to a 1.12 compatibility issue; pin to 1.11 once verified).
2. Wrap MediatR `IPipelineBehavior<,>` so each command and query becomes its own span.
3. Connect OTLP exporter to a Tempo / Jaeger instance (compose file TBD).
4. Document the recommended Grafana dashboards.

Acceptance criteria:

- End-to-end trace from Mobile to API to Postgres visible in Jaeger.
- Each slow query attributable to the originating command.

### 4.2 SLO alerting — P2, M

Define the targets from `SCALE_TO_MILLIONS_PLAN.md` as Prometheus rules and wire them to Alertmanager to Slack / PagerDuty.

Plan:

1. Add `prometheus/rules.yml` with:
   - API P99 reads greater than 25 ms (5 min window)
   - API P99 writes greater than 60 ms
   - Centrifugo CCU less than 80 percent of capacity
   - Outbox pending greater than 1 000 (depends on 1.1)
   - Pod TTL cleaner drift greater than 5 min
2. Add `alertmanager.yml` with Slack receiver.
3. Document runbooks for each alert.

Acceptance criteria:

- Synthetic load test triggers the alert within 1 minute of the breach.

### 4.3 Log aggregation via Vector and Loki — P2, M

Replace local `ILogger` with structured JSON logs shipped to Loki.

Plan:

1. Configure `Serilog` with the OTLP sink.
2. Add `vector` sidecar to `docker-compose.infra.prod.yml` to forward to Loki.
3. Provision a Grafana Loki instance.

Acceptance criteria:

- Logs queryable by `trace_id` and `request_id`.



---

## 5. Mobile app hardening

### 5.1 Migrate ChangeNotifier ViewModels to Riverpod or Bloc — P2, XL

The Flutter app currently has ~10 `ChangeNotifier` ViewModels. They work but rebuild the entire tree on every change and make fine-grained rebuild hard.

Plan:

1. Add `flutter_riverpod` to `pubspec.yaml`.
2. Migrate one VM at a time (start with `FeedViewModel`).
3. Use `AsyncNotifier` and `StreamProvider` to model WebSocket events cleanly.
4. Remove the `MultiProvider` graph from `main.dart` once all VMs are migrated.

Acceptance criteria:

- Scroll FPS in feed / chains / pods >= 58 under a 1 k-item list.
- Rebuild counter for a typical screen interaction drops by >= 50 percent.

### 5.2 Adaptive HTTP timeouts — P2, S

Currently Dio uses a 15 s timeout for everything. Interactive endpoints should be < 3 s; media upload should be >= 60 s.

Plan:

1. Add per-method timeouts in `ApiService`.
2. Add a `RetryInterceptor` with exponential backoff for idempotent GETs only.
3. Surface retry events to the UI as a toast on failure.

Acceptance criteria:

- Interactive requests fail fast (< 3 s) on flaky networks instead of hanging for 15 s.

### 5.3 Centrifugo state replay on cold start — P2, M

When the mobile app is cold-started it currently subscribes to channels and waits for new events. It does not replay missed events during the offline window.

Plan:

1. On cold start, fetch the latest Centrifugo history per channel (`since=<last_seen_offset>`).
2. Deduplicate by event id on the client.
3. Combine with HTTP pagination for catch-up.

Acceptance criteria:

- After re-launching the app after 5 minutes offline, the pod / chain / feed views reflect the missed messages within 2 seconds.

### 5.4 Profile and security UX — P2, S

- Add CAPTCHA / WebAuthn passkey for login from a new device.
- Bind refresh tokens to device fingerprint.
- Add "active sessions" UI surface for revoking devices.

### 5.5 Web build polish — P2, M

The mobile project supports web via `flutter build web`. Several features depend on native APIs (record, LiveKit). Document the supported feature matrix and gracefully degrade on web.



---

## 6. Features that are partially implemented or missing

Goal: finish the product surface. These are user-facing, not infrastructure.

### 6.1 Hashtag trend page — P2, S

`HashtagQueries` already exists and `cache:hashtags:trending:limit:{10,50}` is invalidated correctly. There is no Flutter surface that consumes it.

Plan:

- Add `hashtag_screen.dart` showing trending tags and a list of recent posts per tag.
- Add deep link `/hashtag/{tag}` to `app_router.dart`.

### 6.2 User profile plus follower / following management — P2, M

`UserFollow` and `FollowStatus` are modelled but the UI only has a follow button. Missing:

- Public profile page (`/users/{username}`) with bio, badges, recent posts.
- "Pending follow requests" inbox for private accounts.
- Block / mute.

### 6.3 Notifications inbox — P2, M

Domain events for notifications are emitted but the user has no way to see them as a list.

Plan:

- New aggregate `UserNotification` (already partly modelled as Redis events).
- API: `GET /api/notifications`, `PATCH /api/notifications/{id}/read`.
- Mobile: bell icon in `MobileAppShell`, notifications list sheet.

### 6.4 Content moderation tools — P2, L

- Reporting a post / user / pod to a moderation queue.
- Admin dashboard.
- Auto-moderation for banned words.

### 6.5 OAuth provider expansion — P2, S

Currently Google, Facebook, Twitter, and "custom" are stubbed. Add Apple Sign-In (required for iOS), and finish the "custom" provider so self-hosted IdPs (e.g. Keycloak) work.

### 6.6 Bulk export / GDPR delete — P2, M

`GET /api/users/me/export` returns a ZIP of all the user posts and media. `DELETE /api/users/me` soft-deletes the user (cascade background job).

### 6.7 Chain / Pod archive pages — P2, S

Add archive / history pages for story chains and mood pods so users can browse past completed content.

### 6.8 Meme Canvas v2: collaborative editing — P2, XL

Multi-user drawing canvas via Centrifugo presence plus CRDT (Yjs). Large scope; only ship if the metric shows it drives engagement.



---

## 7. Application stability hardening (no infra changes)

These are correctness and robustness fixes independent of scale.

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 7.1 | Add idempotency keys for `CreatePostCommand`, `CreateChainCommand`, `CreateMoodPodCommand` so a network retry does not double-post | P1 | M | Add `Idempotency-Key` header handling. |
| 7.3 | Centralise "validate user is host or moderator" into a `MoodPodAuthorisationService` (today it is duplicated in 5 handlers) | P2 | S | |
| 7.4 | Fix the chain-cache eviction storm: today every `ChainStepAddedEvent` invalidates `chains:active:anon`, which means everyone refetches the full list | P1 | S | Invalidate per-chain key only; leave the active list alone. |
| 7.5 | Replace `string.Contains(...)` text search in `PostQueries` and `SearchQueries` with `EF.Functions.ILike` (Postgres) | P1 | S | Avoids plan-time `LOWER()` wrapping. |
| 7.6 | Add a composite index `chain_steps(chain_id, step_number)` so the chain detail page stops doing a sort | P1 | S | Confirm with `EXPLAIN`. |
| 7.7 | Add unique index `reactions(post_id, user_id)` (currently only declared, not actually a unique index in the migration) | P1 | S | Verify in `EntityConfigurations.cs`; add `.IsUnique()` if missing. |
| 7.8 | Make `DbInitializer` idempotent across hot-reloads (already mostly there, but `MarkEmailAsConfirmed` should be a no-op when true) | P2 | S | |
| 7.9 | Switch `ICacheService.GetOrDefaultAsync<T>` to return `default!` (not `default(T)`) to avoid null-bomb in callers | P2 | S | |
| 7.10 | Add a `CancellationToken` propagation check on all Redis and Centrifugo calls; many handlers pass `default` | P1 | M | |
| 7.11 | Verify the `PostConfiguration` cascade on `Reactions` is `Cascade` (so deleting a post cleans up reactions) | P1 | S | |
| 7.12 | Add a top-level exception handler for the Hangfire dashboard (when introduced) | P2 | S | |



---

## 8. Security follow-ups

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 8.1 | Add CAPTCHA for `POST /api/auth/register` after N failures per IP | P1 | M | |
| 8.2 | Enable `RequireHttpsMetadata = true` on the JWT bearer in Production | P1 | S | Currently false unconditionally. |
| 8.3 | Add `Content-Security-Policy` header (script-src 'self'; img-src 'self' https://sloopmedia and so on) | P1 | S | |
| 8.4 | Add `Permissions-Policy: camera=(), microphone=(self)` | P2 | S | |
| 8.5 | Verify MinIO bucket is private plus signed GET URLs (today it is public read) | P1 | S | |
| 8.6 | Add audit log table for sensitive actions (login, settings update, moderation action) | P2 | M | |
| 8.7 | Penetration test on auth flows | P3 | XL | Annual. |
| 8.8 | Migrate Centrifugo `centrifugo.json` admin password out of source | P2 | S | Inject via env. |

---

## 9. Testing and CI/CD

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 9.1 | GitHub Actions: `dotnet build`, `dotnet test`, `flutter analyze`, `flutter test` | P1 | S | |
| 9.2 | Add integration tests with `Testcontainers` (Postgres, Redis, Centrifugo) | P1 | M | |
| 9.3 | Add load test scripts (`k6`, `ghz`) for the WS path and the outbox path | P2 | M | |
| 9.4 | Add darwin / Linux smoke-test scripts that `docker compose up` and curl `/health` | P2 | S | |
| 9.5 | Add a CHANGELOG.md convention plus release-drafter | P3 | S | |
| 9.6 | Migrate to GitHub-native OIDC for Centrifugo / MinIO / LiveKit secret rotation | P2 | M | |
| 9.7 | Add `flutter test` coverage report and badge | P2 | S | |
| 9.8 | Add coverage gate on the .NET side (minimum 70 percent on the Domain and Application layers) | P2 | S | |

---

## 10. Recommended execution order

1. **Week 1-2**: 7.1 (idempotency keys), 7.2 (caption length), 7.4 (cache eviction fix), 7.5 (`ILike`), 7.6 plus 7.7 (missing indexes), 8.2 (HttpsMetadata), 8.3 plus 8.4 (CSP / Permissions-Policy), 9.1 (CI).
2. **Week 3-5**: 1.1 (outbox), 4.1 (EF and MediatR OTel).
3. **Week 6-8**: 1.2 (Redis timelines), 1.3 (Redis reaction counters), 2.1 (presigned upload).
4. **Week 9-11**: 1.4 (Hangfire), 2.3 (Centrifugo cluster), 4.2 (SLO alerting).
5. **Week 12+**: 1.5 (Meilisearch), 2.2 (LiveKit cluster plus TURN), 3.x (DB), 5.x (mobile), 6.x (features).

Each sprint ends with: `dotnet test` (must pass), `flutter analyze` (must pass), load test report on staging (if applicable), CHANGELOG entry.

---

## 11. Tracking

This document is the single source of truth for deferred work. Update it as items move from "Planned" to "In progress" to "Shipped" and link the PR that landed each item.

A kanban-style status can be added inline once the team is large enough to warrant it (replace the `Status` column with `Status (Planned / In progress / Blocked / Shipped)`).

