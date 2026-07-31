# CLAUDE.md — CyberShield Operating Manual

This repo contains **CyberShield**, a self-hosted security-awareness training and phishing-simulation
platform. All code lives in `cybershield/` — the repo root has only README, LICENSE, and this file.
**Run every npm/npx/prisma command from `cybershield/`, not the repo root.**

## Rule zero: what to trust

1. **The code** is the only source of truth.
2. **This file** is second.
3. **The READMEs describe intent, not reality.** The root/`cybershield/README.md` advertise features
   that do not exist (Phase 8 "AI Content Generation", `lib/ai`, `lib/risk-score`, `/admin/simulations`,
   `/admin/analytics` pages, `.env.example`). Before acting on any README claim, verify the file or
   route exists. Never create a missing file just to make a README claim true — flag the drift instead.

## Stack (exact, do not "upgrade" from memory)

- **Next.js 14 App Router** (not 15 — see mistake #1), React 18, TypeScript strict, path alias `@/*` → `src/*`
- **NextAuth v5 beta** — credentials provider, JWT sessions, exported as `auth()` from `src/lib/auth.ts`
- **Prisma 5 + PostgreSQL 16** — client singleton in `src/lib/db.ts`, imported as `db`
- **BullMQ + Redis 7** — queues in `src/lib/queues.ts`, workers in `workers/` run as a **separate process** (`tsx`)
- **Tailwind with a custom token palette** (see Design system), Radix primitives wrapped in `src/components/ui/`
- **Zod** for all request validation; **bcryptjs cost 12** for all password hashing; **pdf-lib** for certificates
- No test framework, no CI, no Prettier. The quality gates are `npx tsc --noEmit`, `npm run lint`,
  `npm run build`, and a manual/scripted smoke of the seeded flows (see `/smoke` skill).

## Architecture in five sentences

Server pages (`src/app/**/page.tsx`) query Prisma **directly** and render; they never fetch their own
API. Interactive islands are extracted into sibling `*Client.tsx` / `*Button.tsx` files marked
`"use client"`, receive server data as props, and mutate via `fetch()` to `src/app/api/**` route
handlers. Route handlers use the helpers in `src/lib/api.ts` (`ok`, `bad`, `requireAuth`, `requireRole`,
`handleZodError`, `audit`) and enqueue slow work onto BullMQ queues. Workers (`workers/*.worker.ts`,
registered in `workers/index.ts`) consume those queues and write back through the same `db` singleton.
`src/middleware.ts` does route protection and role gating for `/admin` and `/manager` prefixes.

## Dev commands

```bash
cd cybershield
npm install
npx prisma db push       # NOT `migrate dev` — see mistake #2
npx prisma db seed       # idempotent; safe to re-run
npm run dev              # web on :3000
npm run workers:dev      # separate terminal — required for campaigns/certs/remediation
npx tsc --noEmit && npm run lint   # the minimum bar before any commit
```

Seeded logins: `admin@cybershield.local` / `ChangeMe!2026`, `manager@cybershield.local` / `Manager!2026`,
`alice.chen@cybershield.local` / `Employee!2026`.

## Security invariants — never weaken, in any diff, for any reason

1. **No real credentials are ever stored.** Fake login pages record only `usernameLength`/`passwordLength`
   in interaction metadata. If a change would persist a submitted password, stop.
2. **No outbound mail.** Simulations deliver to the in-app `SimulatedInboxItem` inbox only. Do not add
   SMTP, webhooks to external mail services, or anything that sends simulation content off-box.
3. **Assessment scoring is server-side** (`api/assessments/[id]/submit`). Never move pass/fail
   computation to the client. (Known wart: retention micro-assessment questions leak `correctOptionId`
   to the client — do not copy that pattern into new code.)
4. **`passwordHash` never leaves the server.** Strip it before returning users
   (`users.map((u) => ({ ...u, passwordHash: undefined }))`).
5. **Last-admin protection** — never allow deleting/demoting the final ADMIN.
6. **Every privileged mutation writes an `AuditLog`** via `audit()` from `@/lib/api`.

## Conventions (followed here — copy them exactly)

### API route handlers
- Admin/manager routes: first two lines are always
  ```ts
  const ctx = await requireRole("ADMIN");   // or "MANAGER" (which also admits ADMIN)
  if ("status" in ctx) return ctx;
  ```
  `requireRole`/`requireAuth` return a **Response object** on failure, not a throw — that guard line
  is mandatory, and `ctx.user` is only safe after it.
- Employee-owned resources: scope the query by ownership, never trust the id alone —
  `db.thing.findFirst({ where: { id: params.id, userId: session.user.id } })` or
  `updateMany({ where: { id, userId } })`.
- Body parsing: `schema.parse(await req.json())` inside `try`, `catch (e) { return handleZodError(e) }`.
  Shared schemas go in `src/lib/validations.ts`; single-route schemas may live in the route file.
- Responses: `ok(data)` / `ok(data, 201)` on success, `bad("Message", status)` on failure. Error shape
  is always `{ error: string }` — clients read `data.error`.
- Queue adds are fire-and-forget and **must not fail the request**:
  `await someQueue.add("name", payload).catch(() => {})`. The app must work with Redis down.
- Next.js 14 dynamic params are synchronous: `{ params }: { params: { id: string } }`.

### Pages & client components
- `page.tsx` is an async server component: `const session = await auth()`, redirect if missing,
  parallel-fetch with `Promise.all([...])`, render. No `useEffect` data fetching for initial load.
- Client components live next to their page, named `<Thing>Client.tsx` or `<Action>Button.tsx`,
  take server data as an `initial` prop, keep it in `useState`, and update state optimistically
  after a successful `fetch` (see `admin/departments/DepartmentsClient.tsx` — the canonical example).
- Client mutation pattern: `setBusy(true); setError(null);` → fetch → on `!res.ok` set `error` from
  `data.error` and bail → on success update local state. Destructive actions get a
  `window.confirm(...)` with the entity name in the message.
- Icons are `lucide-react`, sized `h-3.5 w-3.5` (inline/buttons) or `h-4 w-4` (nav/cards).

### Database & Prisma
- IDs are cuid strings. Enums are SCREAMING_SNAKE. Every tenant-ownable model has
  `tenantId String?` + optional `tenant` relation (nullable by design — see Known warts).
- Child-of-owner relations use `onDelete: Cascade`. Join tables get a `@@unique` on the pair.
- Add `@@index` for every new query path you introduce (match the existing `[tenantId, x]` style).
- **Users are soft-deleted** (`deletedAt`). Every `db.user.findMany/findFirst/count` must include
  `deletedAt: null` unless you are deliberately querying the graveyard.
- Seed (`prisma/seed.ts`) is **idempotent**: every record is `upsert` keyed on a **stable, human-readable
  string id** (`"course-phishing-101"`, `"les-ph-1-1"`). New seed data must follow this or re-seeding
  duplicates/crashes.

### Style
- Section dividers in longer files: `// ─── Section name ───────...` (box-drawing dashes).
- Aligned assignments in state blocks and data tables are intentional — keep the alignment when editing.
- Compact related statements on one line are house style: `setBusy(true); setError(null);`.
- Commit messages: `Feature: ...` / `Fix: ...` / `Redesign: ...` prefix, then a comma-separated summary
  of the areas touched. Big-batch commits are normal here.

### Design system (warm light theme, forest-green accent)
- **Only use the token colors** from `tailwind.config.ts`: `canvas`, `surface`, `elevated`, `border`,
  `text-primary/secondary/muted`, `accent` (+`accent-hover`), `success`, `warning`, `danger`,
  `sidebar-*`. Never `bg-white`, `text-gray-500`, `bg-blue-600`, etc. — raw Tailwind palette colors
  are how a page ends up looking foreign.
- Component classes from `globals.css`: `.card`, `.card-elevated`, `.stat-card`, `.section-title`,
  `.label-muted`. Headings use `font-heading` (Sora); body is DM Sans by default.
- Tinted chips/backgrounds use the `/10` opacity pattern: `bg-accent/10 text-accent`,
  `bg-danger/10 text-danger`.
- Tables: `bg-elevated` header row, `text-xs uppercase tracking-wide text-text-muted` header cells,
  `divide-y divide-border` bodies, `hover:bg-elevated/40` rows.
- Every list view needs an **empty state** (icon at `opacity-20`, one-line message, one-line hint).

### Lesson content mini-markdown
`Lesson.content` is rendered by `renderContent()` in `SimulationEngine.tsx`, which supports **only**:
`# H1`, `## Numbered/labelled section` (first sentence becomes the heading), `### H3`, `**bold**`
inline, `**Label:** – item – item` label-lists, standalone `**callout**` blocks, `- ` bullet lists,
`1.` numbered lists, and simple `|`-tables with a `---` row. Blocks are split on **blank lines**.
Links, images, code fences, and nested lists are NOT supported — they render as plain text.

## Named mistakes a weaker model will make here — and the rule that prevents each

1. **The Next-15 reflex.** Writing `const { id } = await params`, `await cookies()`, or other Next 15
   async-API idioms. *Rule: this is Next 14 — `params` is a plain object; copy signatures from an
   existing route in the same folder, never from memory.*
2. **The migration mirage.** Running `prisma migrate dev`/`migrate deploy` because the README says so.
   There is **no `prisma/migrations/` directory** — migrate commands will try to reset or fail.
   *Rule: schema changes ship via `npx prisma db push` + `npx prisma generate`. Do not create a
   migrations directory unless the user explicitly asks to adopt migrations.*
3. **The dead config edit.** Editing `next.config.ts`. Next 14 does not read TypeScript configs; the
   live file is **`next.config.js`**. (The `.ts` file is leftover and is also the only one with
   `output: "standalone"`, which the Dockerfile needs — see Known warts.) *Rule: edit
   `next.config.js`; treat `next.config.ts` as documentation of Docker intent.*
4. **The zombie-user query.** Forgetting `deletedAt: null` and resurrecting soft-deleted users in
   lists, stats, or campaign targeting. *Rule: every User query includes `deletedAt: null`; grep your
   diff for `db.user.` before committing.*
5. **The hash leak.** Returning Prisma `User` objects straight to the client. *Rule: any response
   containing users must strip `passwordHash` (and ideally `select` only what the UI needs).*
6. **The skipped guard.** Calling `requireRole()` and using `ctx.user` without
   `if ("status" in ctx) return ctx;`. It type-checks in some shapes and then 500s at runtime.
   *Rule: the guard line always immediately follows the require call.*
7. **The v4 flashback.** Using `getServerSession`, `authOptions`, or `next-auth/next` imports.
   *Rule: this is NextAuth v5 beta — server code uses `await auth()` from `@/lib/auth`; client code
   uses `signOut` etc. from `next-auth/react`.*
8. **The brittle queue.** `await queue.add(...)` without `.catch(() => {})`, so a request 500s when
   Redis is down (which it often is in local dev). *Rule: queue adds never propagate errors.*
9. **The unaudited mutation.** Adding a create/update/delete route without an `audit()` call.
   *Rule: every mutation route calls `audit(ctx.user.id, "VERB_NOUN", "Entity", id, meta?)` before
   returning; action names are SCREAMING_SNAKE like `USER_CREATE`, `CAMPAIGN_CREATE`.*
10. **The locked-out page.** Adding a public route (or a new top-level section) and forgetting
    `src/middleware.ts` — the page silently redirects to `/login`, or worse, an `/admin`-adjacent
    path is left open. *Rule: any new route outside `/admin`, `/manager`, `/employee`, or the public
    list must be classified in `middleware.ts` in the same diff.*
11. **The foreign-palette page.** Styling with default Tailwind colors so one screen looks like a
    different product. *Rule: if a class contains a color not defined in `tailwind.config.ts`, it's
    wrong.*
12. **The seed landmine.** Adding seed rows with `create()` or random ids, breaking idempotency.
    *Rule: seed additions are upserts keyed on stable slug-style string ids, and `npx prisma db seed`
    must succeed twice in a row.*
13. **The worker import bomb.** Importing anything that transitively pulls in Next.js/NextAuth/React
    into `workers/*`. Workers run under plain `tsx` with no Next runtime. *Rule: workers import only
    `../src/lib/db`, `../src/lib/redis`, `../src/lib/certificate`, and node/npm libs; new workers get
    their own file, an `.on("failed")` handler, and registration in `workers/index.ts` (including the
    `shutdown()` list).*
14. **The README-driven feature.** Building on top of code the README mentions but that doesn't exist
    (e.g. "extend the AI generation in lib/ai"). *Rule: `Read` the file first; if it doesn't exist,
    report the drift and ask before inventing a foundation.*
15. **The threshold guess.** Risk-score coloring/thresholds differ across pages today (40/60/70 in
    different places). *Rule: for new code use `>= 70` high / `>= 40` medium / else low; don't
    "harmonize" existing pages unless asked.*

## Quality bar per deliverable — checkable, not adjectives

Anything you ship must pass the **global gate**: `npx tsc --noEmit` clean, `npm run lint` clean, and
`npm run build` clean if you touched routing, config, middleware, or server/client component boundaries.

**A new/changed API route is done when:**
- [ ] Unauthenticated request returns 401; wrong role returns 403 (verify by reading the guard, or curl).
- [ ] Invalid body returns 400 with `{ error }` produced by `handleZodError`.
- [ ] Employee-owned resources are queried with `userId` in the `where`.
- [ ] Mutations write an `AuditLog`; creates return 201; response shape matches what the client component reads.
- [ ] No `passwordHash`, `correctOptionId` (for active assessments), or raw credential data in any response.
- [ ] Any queue interaction is wrapped in `.catch(() => {})`.

**A new/changed page or component is done when:**
- [ ] Server component fetches via Prisma with `Promise.all` for independent queries; no client-side initial fetch.
- [ ] It renders correctly in three states: populated, empty (designed empty state), and pending (busy/disabled buttons during mutations).
- [ ] Failed mutations surface `data.error` in the standard error banner, not a silent console log.
- [ ] Only design-token colors and existing UI primitives (`Button`, `Input`, `Badge`, `Card`, `.card` classes) are used.
- [ ] Role placement is correct: the page lives under `/admin`, `/manager`, or `/employee`, appears in that layout's nav if it's a section, and middleware covers it.

**A schema change is done when:**
- [ ] New models: cuid id, `tenantId String?` + relation if tenant-ownable, timestamps, cascades on owned children, indexes on new query paths.
- [ ] `npx prisma db push` and `npx prisma generate` both succeed.
- [ ] `prisma/seed.ts` updated if the model needs demo data, and `npx prisma db seed` succeeds **twice consecutively**.
- [ ] No column/enum-value removal or rename without explicit user sign-off (destructive on `db push`).

**A worker/queue change is done when:**
- [ ] Queue created via `makeQueue` in `src/lib/queues.ts`; worker in its own `workers/x.worker.ts` with `{ connection: redis }` and an `.on("failed")` logger.
- [ ] Registered in `workers/index.ts` startup log **and** `shutdown()`.
- [ ] Job handler is idempotent (upsert/updateMany, not blind create) — BullMQ retries mean double delivery.
- [ ] Verified live: run `npm run workers:dev`, enqueue a real job through the app, observe the console log.

**Seed/content changes are done when:** stable ids, upserts, seed runs twice cleanly, and lesson
content uses only the supported mini-markdown (render one course in the browser if you changed content).

## When uncertain — exact escalation rules

**Proceed without asking** (then report what you decided):
- New CRUD features, pages, or fields that follow an existing pattern in this repo.
- Additive schema changes (new model, new nullable/defaulted column) plus their `db push`.
- Bug fixes that preserve observable behavior, styling changes within the token system, seed content.
- Choosing between two conflicting in-repo patterns: copy the one in the **most recently touched**
  file (`git log -1 --format=%cd -- <file>`), and note the conflict in your summary.

**Stop and ask (AskUserQuestion / report and wait) before:**
- Anything that weakens or reinterprets the six security invariants.
- Destructive schema changes: dropping/renaming columns or tables, removing enum values, anything
  where `db push` would warn about data loss.
- Changes to `src/lib/auth.ts` session semantics, `middleware.ts` public-route list, or password/registration flows.
- Adding a runtime dependency (`dependencies` in package.json). Dev-deps for tooling you were asked to add are fine.
- Deleting or rewriting user-visible data, LICENSE, or README feature claims.
- Introducing migrations, tests-as-CI, tenant-scoping enforcement, or any architectural shift — these
  are product decisions, not fixes.
- Any git operation beyond commit/push to the designated branch (force push, rebase of pushed history, branch deletion).

**When the code contradicts this file or the README:** trust the code, do the task against reality,
and call out the contradiction explicitly in your final summary. Do not silently edit docs to match.

**When a task references something that doesn't exist** (file, route, feature): say so and ask,
unless creating it is itself the obvious task.

## Known warts — acknowledged, do not "fix" in passing

- `next.config.ts` is dead (Next 14) and `next.config.js` lacks `output: "standalone"`, which the
  Dockerfile's `COPY .next/standalone` step requires. A Docker build will fail until standalone is
  added to the `.js`. Fix only when working on deployment, and say so.
- Multi-tenant columns exist but **queries are not tenant-scoped** (admin routes list all rows).
  The app is single-tenant in practice; only registration (`api/register/[token]`) is tenant-aware.
  Match the surrounding scoping behavior; don't unilaterally add tenant filters everywhere.
- `User.riskScore` is read all over the UI but **never written** — it's always the default 0. The
  README's "risk score engine" is aspirational.
- Risk thresholds are inconsistent across pages (see mistake #15).
- `workers/index.ts` imports `dotenv/config` but `dotenv` is not a declared dependency (works via
  transitive resolution — fragile).
- Retention micro-assessment sends `correctOptionId` to the client (employee dashboard).
