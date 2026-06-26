# 🛡️ CyberShield

**Enterprise Security Awareness & Phishing Simulation Platform** — fully on-premise, no external mail, nothing leaves your network.

CyberShield is a self-hosted training platform that lets security teams run realistic phishing simulations, deliver mandatory training, auto-remediate failures, and track org-wide risk — all inside a single Docker stack.

---

## ✨ Features

| Phase | Capability |
|-------|------------|
| **1. Foundation** | Next.js 14 App Router, NextAuth credentials, role-based access (Admin / Manager / Employee), Prisma + PostgreSQL, brand-themed dashboard shell |
| **2. Users & Departments** | Full CRUD, search, role assignment, last-admin protection, audit log on every mutation |
| **3. Training** | Multi-module courses, lesson-by-lesson progress tracking, mandatory/optional flags, self-enrol or admin-assign |
| **4. Simulation Engine** | EMAIL / SMS / fake LOGIN_PAGE viewers; live `OPENED`/`CLICKED_LINK`/`SUBMITTED_CREDENTIALS`/`REPORTED`/`IGNORED` tracking; **credentials are NEVER stored** — only lengths |
| **5. Campaigns + Auto-Remediation** | BullMQ-scheduled launches, dept/role/all-users targeting, automatic enrolment in remediation training the moment someone fails |
| **6. Assessments & Certificates** | One-question-at-a-time quizzes, server-side scoring, configurable pass mark (default 80%), PDF certificates with verification code, retake-on-fail |
| **7. Analytics** | Click-rate, report-rate, completion %, avg risk score, 30-day trend chart, department risk heatmap, manager-level team drill-down |
| **8. AI Content Generation** | Claude-powered phishing templates, SMS lures, assessment questions from lesson content, and "hacker mindset" tactic explanations |
| **9. Tips & Notifications** | Daily security tip widget, in-app notifications for remediation/new-hire/cert events, accessible UI throughout |

---

## 🧱 Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + Radix UI primitives + Recharts
- **Backend:** Next.js Route Handlers + Prisma 5 + PostgreSQL 16
- **Auth:** NextAuth v5 (Credentials provider, JWT sessions, 8h)
- **Jobs:** BullMQ on Redis 7 — separate worker process
- **AI:** Anthropic Claude (Sonnet 4) — fully optional, gracefully degrades if no API key
- **PDF:** `pdf-lib` (no headless browser needed)
- **Deployment:** Docker Compose (postgres + redis + web + workers + nginx)

---

## 🚀 Quick start

### Requirements
- Docker & Docker Compose, OR
- Node.js 20+, PostgreSQL 16, Redis 7 (for local dev)

### 1. Clone & configure
```bash
git clone <your-fork-url> cybershield && cd cybershield
cp .env.example .env
```

Edit `.env` — at minimum set `NEXTAUTH_SECRET` (any random 32+ char string).
`ANTHROPIC_API_KEY` is optional — only needed for AI features in Phase 8.

### 2. Run with Docker (recommended)
```bash
cd docker
docker compose up -d --build
# wait ~30s, then run migrations + seed:
docker compose exec web npx prisma migrate deploy
docker compose exec web npx prisma db seed
```

Open **http://localhost** (nginx) or **http://localhost:3000** (direct).

### 3. Or run locally
```bash
npm install
npx prisma migrate dev
npx prisma db seed
# two terminals:
npm run dev          # web on :3000
npm run workers:dev  # background jobs
```

---

## 🔐 Default seeded accounts

| Role     | Email                            | Password         |
|----------|----------------------------------|------------------|
| Admin    | `admin@cybershield.local`        | `ChangeMe!2026`  |
| Manager  | `manager@cybershield.local`      | `Manager!2026`   |
| Employee | `alice.chen@cybershield.local`   | `Employee!2026`  |
| Employee | `bob.smith@cybershield.local`    | `Employee!2026`  |
| Employee | `carol.jones@cybershield.local`  | `Employee!2026`  |
| Employee | `david.patel@cybershield.local`  | `Employee!2026`  |
| Employee | `eve.müller@cybershield.local`   | `Employee!2026`  |

**Change these immediately in production.** The admin email/password can be overridden at seed time via `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

---

## 🗺️ Try it end-to-end

1. **Log in as admin** → `/admin/simulations` → click **Generate with AI** (or use the seeded template) → Save.
2. `/admin/campaigns/new` → pick the template → target a department or All Users → schedule for "1 minute from now".
3. **Log in as an employee** (different browser/incognito) → `/employee/inbox` — your phishing test will appear within ~1 minute.
4. Click the link to "fail" the test, or hit **Report** to "pass". Failing auto-enrols you in the remediation course.
5. Complete the course → take the assessment → get a PDF certificate.
6. Back in admin → `/admin/analytics` to see the risk heatmap update.

---

## 📂 Project structure

```
cybershield/
├── prisma/             # schema + seed
├── src/
│   ├── app/            # Next.js App Router (auth, dashboard, api/)
│   ├── components/     # ui/ shared/ admin/ simulation/ training/ analytics/
│   ├── lib/            # db, auth, redis, queues, ai, validations, risk-score, certificate
│   ├── types/          # next-auth augmentation
│   └── middleware.ts   # route protection + role gating
├── workers/            # BullMQ workers (run as separate process)
├── docker/             # Dockerfile, docker-compose.yml, nginx.conf
└── README.md
```

---

## 🔒 Security & privacy notes

- **No outbound mail.** Simulations are delivered via the in-app `/employee/inbox`, never to real email. No leakage risk.
- **No real credentials stored.** The fake login page sends only `usernameLength`/`passwordLength`. The actual values never reach the server.
- **Audit log on every privileged mutation** (user create/update/delete, course changes, campaign launches, assessment submissions).
- **Last-admin protection** prevents you from deleting your only admin account.
- **NextAuth JWT sessions** — 8h, signed with `NEXTAUTH_SECRET`.
- **Multi-tenant isolation** — every admin/manager query is scoped by the caller's `tenantId`; single-tenant (unscoped) installs are unaffected.
- **Login rate limiting** — 5 failed attempts per email per 15 minutes (Redis-backed; fails open if Redis is unreachable).
- **CSRF defense-in-depth** — state-changing API requests are rejected if their `Origin` header doesn't match the request host, on top of NextAuth's `SameSite=Lax` session cookie.
- **Security headers** — CSP, HSTS, X-Frame-Options, etc. set in `next.config.js`.
- **Structured JSON logging** (`src/lib/logger.ts`) for unhandled API errors and audit-log write failures — pipe stdout to your log aggregator (Datadog, CloudWatch, etc.) in production. No external error-tracking SDK (e.g. Sentry) is wired in; add one if you need alerting.
- For production: set strong `DB_PASSWORD` and `NEXTAUTH_SECRET`, enable TLS in `docker/nginx.conf`, set up regular `postgres` backups of the `cs_postgres_data` volume.

---

## ⏪ Deployment & rollback

- **Roll forward, don't roll back schemas.** `prisma migrate deploy` only applies new migrations — it has no automatic "down." If a migration needs to be undone, write and apply a new corrective migration, or restore the `cs_postgres_data` volume from the last backup taken before the bad deploy.
- **Roll back the app image quickly.** Tag images/builds by git SHA. To roll back: `docker compose pull web=<previous-tag>` (or rebuild from the previous commit) then `docker compose up -d web workers`, skipping `prisma migrate deploy` unless the previous version expects an older schema.
- **Always back up before migrating.** Snapshot the `cs_postgres_data` volume (or run `pg_dump`) immediately before any `prisma migrate deploy` in production, so a bad migration can be undone by restoring the snapshot rather than improvising a down-migration under pressure.
- **Zero-downtime note.** This stack has no blue/green or canary support out of the box — `docker compose up -d --build` briefly drops the `web` container. For zero-downtime deploys, run two `web` replicas behind nginx/a load balancer and roll them one at a time.

---

## 🧪 Useful scripts

```bash
npm run dev              # next dev (port 3000)
npm run build            # next build (standalone output)
npm run start            # next start
npm test                 # vitest run (validation schemas, CSRF check, logger)
npm run workers:dev      # tsx workers/index.ts (with watch)
npm run workers:start    # node-runner workers (prod)
npx prisma studio        # browse the DB in a UI
npx prisma migrate dev   # create/apply a new migration
npx prisma db seed       # re-run the seed
```

---

## 🤝 Contributing

This is an on-premise template — fork it, brand it for your org, extend it. Common next steps:
- Wire Slack/Teams notifications via webhooks
- Add SSO (SAML / OIDC) by swapping the NextAuth provider
- Plug a real mail server if you ever want external simulations (not recommended for liability reasons)
- Hook the analytics endpoints into your SIEM via the `/api/analytics/*` JSON endpoints

---

## 📄 License

Internal use template — adapt freely. No warranty.
