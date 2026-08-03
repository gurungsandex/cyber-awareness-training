# CyberShield — Deployment Guide

Production deployment for the self-hosted CyberShield stack (web + workers +
PostgreSQL + Redis + nginx), delivered as a single Docker Compose project.

---

## 1. Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Docker Engine | **24.0+** | `docker --version` |
| Docker Compose | **v2.20+** | Bundled as `docker compose` (v2 syntax used here) |
| Host OS | Linux x86-64 | 2 vCPU / 4 GB RAM minimum for the full stack |
| Open ports | 80 (and 443 once TLS is wired) | nginx front door; `:3000` is the app if you bypass nginx |

For a **host-based** (non-Docker) install instead, you need Node.js **20 LTS**,
PostgreSQL **16**, and Redis **7** running and reachable.

The images pin their own runtimes — you do **not** need Node/Postgres/Redis on
the host when using Docker Compose:

- App/workers image base: `node:20-alpine`
- Database: `postgres:16-alpine`
- Cache/queue: `redis:7-alpine`
- Proxy: `nginx:1.27-alpine`

---

## 2. Environment variables

Create `.env` in the repo root (next to `docker/`), copying from `.env.example`.
Compose reads it automatically.

| Variable | Required | Example / Default | Purpose |
|----------|----------|-------------------|---------|
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` | Signs JWT sessions. Compose refuses to start without it. |
| `NEXTAUTH_URL` | ✅ | `https://cybershield.your-org.local` | Public URL for auth callbacks. |
| `DB_PASSWORD` | ✅ (prod) | strong random string | Postgres password (used to build `DATABASE_URL` inside compose). |
| `DATABASE_URL` | auto (compose) | derived from `DB_PASSWORD` | Set explicitly only for host-based installs. |
| `REDIS_HOST` / `REDIS_PORT` | auto (compose) | `redis` / `6379` | BullMQ connection. |
| `LOG_LEVEL` | ❌ | `info` | `debug`\|`info`\|`warn`\|`error`. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | ❌ | your admin creds | Set **before** seeding so the default admin isn't `ChangeMe!2026`. |
| `ANTHROPIC_API_KEY` | ❌ | — | Reserved for planned AI features; safe to omit. |

> **Never commit `.env`.** It is git-ignored. Rotate `NEXTAUTH_SECRET` and
> `DB_PASSWORD` per environment.

---

## 3. Install & run (Docker Compose)

```bash
# from the repo root
cp .env.example .env
# edit .env: set NEXTAUTH_SECRET, NEXTAUTH_URL, DB_PASSWORD, SEED_ADMIN_*

cd docker
docker compose up -d --build          # build & start postgres, redis, web, workers, nginx
```

Postgres and Redis start first; `web` waits for both to be healthy, and nginx
waits for `web` to pass its `/api/health` check.

Apply the schema and seed initial data (first deploy only):

```bash
docker compose exec web npx prisma migrate deploy
docker compose exec web npx prisma db seed
```

The app is now served at **http://localhost** (nginx) or
**http://localhost:3000** (direct).

### Host-based alternative

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build && npm run start      # web on :3000
npm run workers:start               # background jobs (separate process/host)
```

---

## 4. Verify a healthy deploy

```bash
# 1. Health endpoint returns 200 and database "up"
curl -fsS http://localhost:3000/api/health | jq
# → { "status": "healthy", "checks": { "database": "up", "redis": "up" }, ... }

# 2. All containers report healthy/running
docker compose ps

# 3. Workers connected (structured JSON log line)
docker compose logs workers | grep '"CyberShield workers starting"'

# 4. Sign in as the seeded admin and confirm the dashboard loads
```

A deploy is good when `/api/health` is `200 healthy`, `docker compose ps` shows
`web`/`workers`/`postgres`/`redis`/`nginx` up (web/postgres/redis `healthy`), and
you can authenticate.

---

## 5. Upgrades & rollback

### Upgrade

```bash
git pull
cd docker
docker compose up -d --build
docker compose exec web npx prisma migrate deploy   # apply any new migrations
```

### Rollback

Images are rebuilt from source, so roll back by checking out the previous
release and rebuilding:

```bash
git checkout <previous-good-tag-or-sha>
cd docker
docker compose up -d --build
```

- **Data volumes** (`cs_postgres_data`, `cs_redis_data`, `cs_certificates`) are
  preserved across rebuilds — a code rollback does not touch your data.
- **Reversing a migration:** Prisma does not auto-generate down-migrations.
  Restore from a database backup taken before the upgrade:
  ```bash
  # backup (take one BEFORE every upgrade)
  docker compose exec -T postgres pg_dump -U cybershield cybershield > backup-$(date +%F).sql
  # restore
  docker compose exec -T postgres psql -U cybershield -d cybershield < backup-YYYY-MM-DD.sql
  ```

---

## 6. Troubleshooting — three most likely failure points

### a) `web` never becomes healthy / stuck restarting
Almost always the **database isn't reachable or migrations haven't run**.
- `docker compose logs web` — look for Prisma connection errors.
- Confirm `postgres` is healthy: `docker compose ps`.
- Ensure migrations ran: `docker compose exec web npx prisma migrate deploy`.
- `curl http://localhost:3000/api/health` — a `503` with `"database":"down"`
  confirms the DB path is the problem.

### b) Compose exits immediately with a `NEXTAUTH_SECRET` error
The `web` service declares `NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?Must set...}`,
so an unset secret aborts startup by design.
- Ensure `.env` exists in the repo root (compose's working dir is `docker/`, but
  it reads the root `.env` — run `docker compose` from `docker/`).
- Set a real value: `NEXTAUTH_SECRET="$(openssl rand -base64 32)"`.

### c) Campaigns never deliver / certificates never generate
These run on the **workers** process via Redis.
- `docker compose ps` — is `workers` up? Is `redis` healthy?
- `docker compose logs workers` — look for `"redis check failed"` or queue
  errors. `/api/health` showing `"redis":"down"` (status `degraded`) confirms a
  Redis connectivity issue.
- Verify a scheduled campaign's `scheduledAt` is in the past/near-future and the
  worker was running when it fired.

---

## 7. Production hardening checklist

- [ ] Strong, unique `NEXTAUTH_SECRET` and `DB_PASSWORD` per environment.
- [ ] Change/override the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) and rotate all demo passwords.
- [ ] Enable TLS in `docker/nginx.conf` (uncomment the 443 block, mount certs) and add the HSTS header.
- [ ] Scheduled `pg_dump` backups of the `cs_postgres_data` volume.
- [ ] Ship the JSON logs to your aggregator; alert on `/api/health` non-200.
- [ ] Review the open security recommendations in the hardening PR (tenant-scoped queries, login rate-limiting, authenticated certificate downloads, CSP).
