# CyberShield — AI Operating Manual

This file is the authoritative operating guide for AI assistance on this
codebase. Read it fully before writing any code. Every rule here was
derived from a defect found and fixed in production-readiness review — none
of it is hypothetical.

---

## 1. What this project is

**CyberShield** is a multi-tenant SaaS platform for security-awareness
training and in-app phishing simulation. Tenants are companies; users inside
a tenant have one of three roles: `ADMIN`, `MANAGER`, `EMPLOYEE`.

Stack:
- **Next.js 14.2.35** — App Router only (no Pages Router). `src/app/`.
- **Prisma 5 + PostgreSQL 16** — schema at `prisma/schema.prisma`.
- **NextAuth v5 (beta)** — credentials provider, JWT sessions, 8-hour TTL.
- **BullMQ + ioredis** — four background workers in `workers/`. Separate
  process from the web server (`npm run workers:dev`).
- **Vitest** — unit tests only (no E2E). `npm test`.
- **Tailwind CSS** — strictly custom design tokens, not the default palette.

---

## 2. Conventions to follow

### Auth and session

Every server component and route handler starts with auth and role
extraction in the same order — do not deviate:

**In page.tsx (Server Component):**
```ts
const session = await auth();
if (!session?.user) redirect("/login");
const role = (session.user as any).role;
if (role !== "ADMIN") redirect("/");   // or check for MANAGER
const tenantId = (session.user as any).tenantId ?? null;
```

**In route.ts (API Route):**
```ts
const ctx = await requireRole("ADMIN");   // or "MANAGER"
if ("status" in ctx) return ctx;
const tenantId = (ctx.user as any).tenantId ?? null;
```

`requireRole("ADMIN")` allows only ADMIN.
`requireRole("MANAGER")` allows ADMIN **and** MANAGER.

Fields `role` and `tenantId` are not on the default NextAuth `User` type —
always cast with `(session.user as any).field` or `(ctx.user as any).field`.

### Tenant scoping

Every query that touches tenant-owned data must filter by `tenantId`.
The pattern differs by model:

**For users, departments, campaigns, audit logs, notifications** — direct
column, exact match is correct because the column is non-nullable:
```ts
const tenantFilter = tenantId ? { tenantId } : {};
where: { ...tenantFilter }
```

**For `Course` and `SimulationTemplate`** — `tenantId` is **nullable**.
`null` means "global / library item visible to every tenant". An exact-match
filter against a real `tenantId` never matches `null` rows, silently
returning zero results. Always use the OR-with-null pattern:
```ts
where: {
  ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {})
}
```

The correct model for reading this: a course with `tenantId: null` is a
platform library course. Every tenant can see and use it. The exact-match
guard `{ tenantId }` is for *ownership* and *creation* — a tenant creating a
course stamps their own `tenantId` on it. Reading uses the OR.

**For relations that don't have a direct `tenantId` column** — scope through
the relation that does:
```ts
where: { user: tenantFilter }      // Enrollment
where: { campaign: tenantFilter }  // SimulationInteraction
```

### Manager scoping

Managers see only their own department's employees. `User.managerId` is
**never set by any code path** in this project (no form, no seed, no API).
Any query that scopes by `managerId` will always return zero results.

The correct scope for manager views is `departmentId`:
```ts
const manager = await db.user.findUnique({
  where: { id: currentUserId },
  select: { departmentId: true },
});
where: {
  role: "EMPLOYEE",
  departmentId: manager?.departmentId ?? "__none__",
  ...(tenantId ? { tenantId } : {}),
}
```

The sentinel `"__none__"` is intentional: it produces an empty result set
if the manager has no department, which is safe and visible in the UI.

### Manager grant check

When a MANAGER calls any course-related action (assign, view course list),
first verify they hold a `ManagerGrant` for that course:
```ts
if ((ctx.user as any).role === "MANAGER") {
  const grant = await db.managerGrant.findUnique({
    where: { managerId_courseId: { managerId: ctx.user.id!, courseId } },
  });
  if (!grant) return bad("Forbidden", 403);
}
```
`requireRole("MANAGER")` alone is not sufficient for course actions —
it only checks the role, not the per-course grant.

### Never leak `passwordHash`

`User` rows contain `passwordHash`. It must never appear in any API
response, rendered page, or included relation. When querying users for
output, either:
- Add `select: { id: true, name: true, email: true, role: true, ... }`
  (omitting `passwordHash`), or
- Map the result: `.map((u) => ({ ...u, passwordHash: undefined }))`

### API route structure

The standard shape for a mutation route:
```ts
export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const body = myZodSchema.parse(await req.json());  // throws on bad input
  // ... db work ...
  await audit(ctx.user.id!, "ACTION_NAME", "Entity", entityId);
  return ok(result, 201);
});
```

`withApiErrorHandling` catches Zod errors and uncaught Prisma errors,
returning `{ error }` JSON instead of Next.js's default HTML error page.
Every state-changing route must call `audit()`. Every request body must
go through a named Zod schema before use.

### Middleware — the edge/Node split

`src/middleware.ts` runs on the **Edge runtime**. Edge cannot use Node-only
APIs (sockets, bcrypt, ioredis). Therefore:

- `src/lib/auth.config.ts` — edge-safe. Contains only session callbacks,
  no providers. **This is what middleware imports.**
- `src/lib/auth.ts` — Node-only. Contains the Credentials provider with
  bcrypt and redis. **Pages and route handlers import this.**

Never import `@/lib/auth` (or anything that transitively imports `ioredis`
or `bcryptjs`) into `src/middleware.ts`. The app will 500 on every request
in production with no obvious error message.

### Styling

Only use design tokens defined in `tailwind.config.ts`. The full token set:

| Token | Use |
|---|---|
| `canvas` | Page background |
| `surface` | Card/panel background |
| `elevated` | Slightly raised surfaces |
| `border` | All dividers and borders |
| `text-primary` | Main readable text |
| `text-secondary` | Secondary labels |
| `text-muted` | Tertiary/placeholder |
| `accent` | Brand green (CTA, active states) |
| `success` | Positive indicators |
| `warning` | Warning/amber |
| `danger` | Errors, destructive actions |
| `sidebar-bg` | Sidebar only |

Do not use raw Tailwind colors (`blue-500`, `gray-100`, etc.). Do not
hardcode hex values. The `.card` and `.card-elevated` CSS utility classes
from `globals.css` encapsulate the standard surface styling.

### Data fetching in pages

Run all independent queries in a single `Promise.all`. Never `await` a
Prisma call, then `await` another one serially when they are independent —
it adds unnecessary waterfall latency.

```ts
const [users, courses, departments] = await Promise.all([
  db.user.findMany({ ... }),
  db.course.findMany({ ... }),
  db.department.findMany({ ... }),
]);
```

---

## 3. Named mistakes a weaker model will make

### Mistake 1 — The nullable Course tenantId trap

**Symptom:** Page renders "No courses yet." or stat card shows `0` despite
10 seeded courses existing. API returns `{"totalCourses": 0}`.

**Cause:** Writing `where: { status: "PUBLISHED", ...tenantFilter }` on a
`Course` query. `tenantFilter` is `{ tenantId: "<real-id>" }`. Prisma's
exact match does not return rows where `tenantId IS NULL`. All 10 seeded
courses have `tenantId: null`.

**Rule:** Every `Course` and `SimulationTemplate` read must use
`...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {})`.
Never spread `tenantFilter` onto these two models directly.

---

### Mistake 2 — Importing auth.ts in middleware

**Symptom:** Every page in the app returns HTTP 500 in production.
Error in logs: `TypeError: Cannot read properties of undefined (reading
'charCodeAt')` inside `redis-errors`.

**Cause:** `middleware.ts` imports anything from `@/lib/auth` (which
imports `ioredis` and `bcryptjs`), causing Edge runtime crash.

**Rule:** `src/middleware.ts` imports **only** `@/lib/auth.config`. If you
add new helpers that middleware needs, put them in `auth.config.ts` (edge-
safe) or a separate file with no Node imports. After any middleware edit,
run `npm run build` and verify the `ƒ Middleware` bundle size in the output
— it should stay at ~79kB. A jump to 150kB+ means a Node-only module leaked in.

---

### Mistake 3 — requireRole("ADMIN") on a route managers need

**Symptom:** Manager clicks "Assign Course" in the UI and receives 403
Forbidden.

**Cause:** `requireRole("ADMIN")` in `src/lib/api.ts` allows only
`["ADMIN"]`. A MANAGER caller is always rejected, regardless of what the
route description says.

**Rule:** Routes accessible to both admins and managers use
`requireRole("MANAGER")`, which allows `["ADMIN", "MANAGER"]`. Routes
accessible only to admins use `requireRole("ADMIN")`. Check the actual
`allowed` array in `src/lib/api.ts:requireRole` if you're unsure.

---

### Mistake 4 — Forgetting the ManagerGrant check

**Symptom:** Any authenticated manager can assign any course, bypassing
the admin's per-course access controls for managers.

**Cause:** Using `requireRole("MANAGER")` and treating that as sufficient
authorization for course assignment.

**Rule:** For any route that assigns or otherwise acts on a specific course
on behalf of a manager, the handler must also check
`db.managerGrant.findUnique({ where: { managerId_courseId: ... } })` for
MANAGER callers. See `src/app/api/admin/courses/[id]/assign/route.ts` for
the reference implementation.

---

### Mistake 5 — Scoping manager views by managerId

**Symptom:** Manager dashboard shows "No employees found." / team table
empty. API returns `totalUsers: 0`.

**Cause:** Querying `where: { managerId: currentUserId }`. `User.managerId`
is never set by any code in this project.

**Rule:** Manager team-scoping always uses `departmentId`. Look up the
manager's own `departmentId` first, then filter employees by that value.
See `src/app/manager/page.tsx` for the reference implementation.

---

### Mistake 6 — Returning a User without stripping passwordHash

**Symptom:** API response JSON contains `"passwordHash": "$2a$12$..."`.

**Cause:** `db.user.findMany({})` without a `select` or post-map returns
all fields including `passwordHash`.

**Rule:** All user queries for API responses or page data must either
specify an explicit `select` that omits `passwordHash`, or map results with
`.map((u) => ({ ...u, passwordHash: undefined }))`. The `GET /admin/users`
route in `src/app/api/admin/users/route.ts` is the reference. Grep for
`passwordHash` in any response you're building before shipping.

---

### Mistake 7 — Starting the dev server without checking Postgres and Redis

**Symptom:** Dev server starts but every page returns a Prisma error or
Redis connection error. `npm run dev` log shows `Can't reach database
server at localhost:5432` or `Connection refused 6379`.

**Cause:** In this sandbox, Postgres and Redis are background services that
can be killed between sessions or between shell invocations.

**Rule:** Before any verification that depends on the app:
```bash
service postgresql start
redis-server --daemonize yes
pg_isready -h localhost -p 5432   # must print "accepting connections"
redis-cli ping                     # must print "PONG"
```

---

### Mistake 8 — Curl hitting the wrong port after a server restart

**Symptom:** Curl returns the old (unfixed) page content even after edits.
Or `curl http://localhost:3000/...` returns HTTP 000 (connection refused).

**Cause:** If a previous `next dev` process is still alive on port 3000 when
a new one starts, Next.js moves the new process to port 3001. Curl to :3000
then hits the old process (which has the old code loaded), or hits nothing
if you killed the old process.

**Rule:** After restarting the dev server, check `/tmp/dev.log` for
`⚠ Port 3000 is in use, trying 3001 instead`. If it appears, either kill
the stale process (`ps aux | grep next-server` → kill the older PID) and
restart, or send all verification curl requests to the port shown in the
log. Never assume :3000 without confirming.

---

## 4. Quality bar per deliverable

### API route — checklist before marking done
- [ ] `requireRole("ADMIN" | "MANAGER")` at the top; `"status" in ctx` guard
- [ ] `tenantId` extracted from `ctx.user`; all queries use it
- [ ] `Course`/`SimulationTemplate` reads use `OR: [{ tenantId }, { tenantId: null }]`
- [ ] No `passwordHash` field in any response body
- [ ] Request body parsed through a named Zod schema before first use
- [ ] `audit()` called for every state change
- [ ] Handler wrapped in `withApiErrorHandling` OR has full `try/catch` + `handleZodError`
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm test` — 33/33 passing

### Server Component page — checklist before marking done
- [ ] `auth()` → `redirect` guard at top of the default export
- [ ] All parallel data fetches in a single `Promise.all`
- [ ] `Course` queries use `OR: [{ tenantId }, { tenantId: null }]`
- [ ] Manager pages scope employees by `departmentId`, not `managerId`
- [ ] No inline user data includes `passwordHash` (check `include: { user: ... }`)
- [ ] Only design tokens used in className strings — no raw colors or hex
- [ ] `npx tsc --noEmit` — zero errors

### Middleware change — checklist
- [ ] File imports only from `@/lib/auth.config`, never `@/lib/auth`
- [ ] `npm run build` passes; Middleware bundle in output is ≤ 85kB

### Schema migration — checklist
- [ ] `npx prisma migrate dev --name <descriptive-name>` run locally
- [ ] Migration SQL reviewed before committing
- [ ] `npm run db:seed` succeeds on a fresh database after migration
- [ ] `npm test` 33/33 after migration

---

## 5. What to do when uncertain

### Ask the user (stop and do not proceed) when:

1. **A schema migration is needed.** `prisma migrate dev` is destructive in
   production. Any additive or breaking schema change needs explicit sign-off.
   Specifically: adding a new model, renaming a column, adding a required
   field to an existing model, or changing a relation.

2. **An environment variable needs editing.** Do not change `.env` or suggest
   changing `NEXTAUTH_SECRET`, `DATABASE_URL`, or `ANTHROPIC_API_KEY` values
   without explicit instruction.

3. **A new npm dependency is required.** The package set is deliberate.
   Adding a dependency changes the attack surface and the audit trail.

4. **A route's authorization model is changing.** Moving a route from
   ADMIN-only to MANAGER-accessible (or public) is a security decision that
   has consequences beyond the route itself (audit trails, tenant isolation,
   ManagerGrant enforcement).

5. **The ManagerGrant logic or the tenant isolation pattern is being changed.**
   These two mechanisms are the entire multi-tenant security boundary. Any
   change to them requires explicit sign-off — don't "simplify" them.

6. **A worker job is being changed.** Workers produce real side effects
   (emails simulated, risk scores mutated, certificates issued, enrollments
   created). Even in development they write to the live database. Confirm
   before changing job logic.

### Proceed autonomously (make the call) when:

- The fix follows a pattern already established in this codebase (e.g., adding
  the OR-null Course guard to a new query site, stripping passwordHash from a
  new endpoint, adding a missing audit() call).
- A TypeScript or lint error has an obvious correct fix.
- A missing `Promise.all` is slowing down a page with sequential awaits.
- The change is purely additive to a file that already exists and passes tests.

### If the fix is ambiguous (you see multiple defensible approaches):

State the two options and your recommendation in one sentence each.
Do not implement until the user picks. If neither option is right, say so.

---

## 6. Local environment reference

### Services
```bash
# Start Postgres (if down)
service postgresql start && pg_isready -h localhost -p 5432

# Start Redis (if down)
redis-server --daemonize yes && redis-cli ping
```

### Dev server
```bash
cd cybershield
npm run dev             # Next.js on :3000 (or :3001 if :3000 is occupied)
npm run workers:dev     # BullMQ workers (separate terminal/process)
```

### Database
```bash
cd cybershield
npm run db:seed         # Seed all fixture data (idempotent)
npm run db:migrate      # Run pending migrations
npm run db:studio       # Prisma Studio on :5555
```

### Check suite (run in this order)
```bash
cd cybershield
npx tsc --noEmit        # Type errors
npm run lint            # ESLint
npm test                # Vitest (33 tests)
npm run build           # Production build (catches Edge bundle issues)
```

### Seeded accounts
| Role | Email | Password |
|---|---|---|
| ADMIN | admin@cybershield.local | `ChangeMe!2026` (or `SEED_ADMIN_PASSWORD` env) |
| MANAGER | manager@cybershield.local | `Manager!2026` |
| EMPLOYEE | alice.chen@cybershield.local | `Employee!2026` |
| EMPLOYEE | eve.muller@cybershield.local | `Employee!2026` |
| EMPLOYEE | employee.N@cybershield.local (N=1–8) | `Employee!2026` |

Manager and her two named employees (Alice Chen, Eve Müller) are all in the
IT department. This is the only manager–team relationship in the seed data.

### Inline database verification
```bash
cd cybershield
DATABASE_URL="postgresql://cybershield:cybershield@localhost:5432/cybershield" \
  npx tsx -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  const result = await db.course.count();
  console.log(result);
  await db.\$disconnect();
})();
"
```

### Live HTTP verification
```bash
PORT=3001  # adjust to whatever port the dev server is on

# 1. Get CSRF token + start cookie jar
CSRF=$(curl -s -c /tmp/cj.txt http://localhost:$PORT/api/auth/csrf \
  | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# 2. Log in as admin
curl -s -b /tmp/cj.txt -c /tmp/cj.txt -X POST \
  http://localhost:$PORT/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&email=admin@cybershield.local&password=ChangeMe!2026&redirect=false&json=true" \
  -o /dev/null -w "%{http_code}\n"

# 3. Hit any authenticated endpoint
curl -s -b /tmp/cj.txt http://localhost:$PORT/api/admin/stats
```

---

## 7. Key file map

| Path | Purpose |
|---|---|
| `src/lib/auth.config.ts` | Edge-safe NextAuth config. Middleware imports this. |
| `src/lib/auth.ts` | Full NextAuth with Credentials/bcrypt/redis. Pages import this. |
| `src/lib/api.ts` | `ok`, `bad`, `requireRole`, `audit`, `withApiErrorHandling`. |
| `src/lib/csrf.ts` | `isTrustedOrigin` — middleware CSRF check. |
| `src/lib/validations.ts` | Zod schemas shared across routes. |
| `src/lib/scoring.ts` | Assessment scoring logic (pure function, tested). |
| `src/middleware.ts` | Edge route guard. Only imports auth.config. |
| `prisma/schema.prisma` | Source of truth for all models and relations. |
| `prisma/seed.ts` | Idempotent fixture data. Run `npm run db:seed`. |
| `workers/` | BullMQ workers. Separate process. Four queues: certificates, remediation, simulations, newhire. |
| `docker/docker-compose.yml` | Production topology: postgres, redis, web, workers, nginx. |
| `PRODUCTION_READINESS.md` | Itemized audit log of every fix and accepted risk. Update this when fixing a bug. |
| `SECURITY.md` | OWASP Top 10 mapping with file-level evidence. |
