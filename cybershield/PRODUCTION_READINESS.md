# Production readiness — audit status

Itemized status against the full audit checklist used for this review.
Each item is marked **Fixed** (with evidence), **Verified clean** (audited,
no issue found), **Accepted risk** (known gap, deliberately not built —
see rationale), or **Out of scope for this review** (requires a decision
this review cannot make autonomously: legal sign-off, a new feature, or
infrastructure this sandbox cannot exercise).

## Edge-runtime middleware crash — Fixed (Critical)
Got the local Postgres/Redis/Prisma toolchain working for the first time
this review (previously blocked by an unreliable binary download through
the sandbox proxy, worked around via direct `curl` + manual placement of
the query-engine binary) and ran `npm run dev` against a live database for
the first time. A live `curl http://localhost:3000/login` returned **HTTP
500** on every request: `src/middleware.ts` (Edge runtime) imported the
full `@/lib/auth`, which imports `ioredis` at module scope for login
rate-limiting — `ioredis` requires Node.js APIs unavailable on the Edge
runtime, crashing with `TypeError: Cannot read properties of undefined
(reading 'charCodeAt')` inside `redis-errors`. Since the middleware
matcher (`/((?!_next/static|_next/image|favicon.ico|certificates).*)`)
covers nearly every route, **this would have 500'd almost the entire app
in production**. Fixed with the standard NextAuth v5 edge/Node split:
extracted `src/lib/auth.config.ts` (session/callbacks only, no providers)
for `middleware.ts` to build its own lightweight edge-safe auth instance
from, while `auth.ts` keeps the Credentials provider with bcrypt/redis/db.
Verified: `/login` now returns 200, middleware bundle size dropped from
150kB to 79.2kB (ioredis/bcrypt no longer bundled), and `npm run lint`,
`tsc --noEmit`, `npm test` (33/33), and `npm run build` all pass.

## Database migrations — Fixed (Critical)
`prisma/migrations/` did not exist anywhere in the repo, despite the
README documenting `prisma migrate deploy` as the production deploy step
— a fresh-database deploy following the documented steps would have
silently created zero tables. Generated the repo's first real migration
(`20260626163910_init`) against a locally provisioned Postgres instance,
then ran a real index audit against the now-working toolchain (cross-
referencing `@@index`/`@@unique` declarations against actual relation-
filtered query sites in `src/`) and found two hot-path foreign keys
missing an index — `AssessmentAttempt.userId` and `Certificate.userId`,
both queried via `user.relation` lookups on the certificates/results
pages — fixed via a second migration
(`20260626164220_add_assessment_certificate_indexes`). `prisma db seed`
ran cleanly against the migrated schema.

## Login page exposed real credentials in plaintext — Fixed
`LoginForm.tsx` rendered a "Demo accounts" panel with the actual admin,
manager, and employee passwords in clear text, unconditionally — found
during a live UI walkthrough enabled by the now-working dev server. This
would ship real credentials, including the admin account, visible to any
unauthenticated visitor on the public login page. Gated the panel behind
`process.env.NODE_ENV !== "production"`; confirmed via `npm run build`
that the credential strings no longer appear anywhere in the production
bundle (`grep` for the literal password values against `.next/server`
returns no matches).

## Login form accessibility — Fixed
The Email/Password `<label>` elements had no `htmlFor`/`id` association
with their inputs, found during a live keyboard-navigation walkthrough of
the now-running login page — a screen reader landing on either input
would not announce its label (WCAG 1.3.1, 4.1.2). Added matching
`id`/`htmlFor` pairs (`login-email`, `login-password`).

## Course assignment and course-settings endpoints 404'd for every tenant — Fixed (Critical, core feature non-functional)
Investigated `/manager/courses`, which renders an "Assign" button (`AssignCourseButton.tsx`) for managers and tells them "your administrator grants access to specific courses" — implying managers can assign courses they've been granted via `ManagerGrant`. Live-testing as the seeded manager account (after creating a real `ManagerGrant` row) against `POST /api/admin/courses/[id]/assign` returned **403 Forbidden** even with a valid grant, because the route used `requireRole("ADMIN")`, which (per `src/lib/api.ts`) excludes every MANAGER caller — a manager-facing UI flow that always failed. While fixing that, live-testing the *same endpoint as an ADMIN* (the role it was supposedly built for) turned up a second, more severe bug: it returned **404 "Course not found"** for every single seeded course, for every tenant, including ADMIN. Root cause: `if (!course || (tenantId && course.tenantId !== tenantId)) return bad("Course not found", 404)` does not account for global/library courses (`Course.tenantId = null` — all 10 seeded courses), so any tenant-scoped caller was always rejected. The same bug, byte-for-byte, existed in `PATCH /api/admin/courses/[id]` (course settings — `isMandatory`/`isRecurring`/etc.), independently confirmed 404ing live. **This meant the admin-facing "assign course to users" and "update course settings" actions — core to the role's "role-based training" responsibility — were completely non-functional for every tenant in the system**, not just for managers. Fixed both routes with the same `tenantId && course.tenantId && course.tenantId !== tenantId` guard already used correctly for global `SimulationTemplate`s in `api/admin/campaigns/route.ts` (a null `tenantId` on the course/template means "global", not "belongs to no one"). Also changed the assign route to `requireRole("MANAGER")` (allows both ADMIN and MANAGER) and added an explicit `ManagerGrant` existence check for MANAGER callers, mirroring the assessment-enrollment-check fix above, so a manager can only assign courses they've been explicitly granted by an admin — not bypass that restriction via direct API access. Verified live end-to-end: ADMIN PATCH course settings 404→200; ADMIN assign-course 404→200 (8 users enrolled); MANAGER assign on an ungranted course correctly 403s; MANAGER assign on a granted course succeeds (200, 8 enrolled). All test enrollments/notifications/grants created during verification were deleted afterward. `npm run lint`, `tsc --noEmit`, `npm test` (33/33), and `npm run build` all pass after the change.

## Phishing campaigns never delivered simulated emails — Fixed (Critical, core feature non-functional)
Audited the campaign-management workflow (the #1 responsibility in this
review's benchmark role: "security awareness and phishing campaign
management") and found `workers/simulation.worker.ts`'s `launch` handler
only flipped `Campaign.status` to `RUNNING` — it never resolved
`CampaignTarget` rows (department/role/all-users) to actual users, and
never created a single `SimulatedInboxItem`. Confirmed via grep that no
code path anywhere in `src/` or `workers/` ever called
`simulatedInboxItem.create`/`createMany`. This meant **the entire
phishing-simulation product feature was non-functional**: an admin could
create and "launch" a campaign, but no employee would ever receive a
simulated phishing email, so nothing could be clicked, reported, scored,
or fed into risk-score/behavioral-metrics — the application's core
value proposition. Fixed by having the worker resolve each campaign's
targets into the matching tenant-scoped user set and bulk-create
`SimulatedInboxItem` rows from the campaign's `SimulationTemplate`
payload (subject/sender/body). Also closed a related gap in
`POST /api/admin/campaigns`: `templateId` was never checked against the
admin's own tenant, allowing a campaign to be built from another
tenant's simulation template. Verified live end-to-end against the local
database: created a real campaign with an `allUsers` target, ran the
worker's resolution logic, confirmed 10 employees received a correctly-
populated inbox item matching the template content, then cleaned up the
test data. `department`/`role`-scoped targeting is inherently tenant-safe
even without an explicit check, since the worker's query ANDs
`tenantId` with the target filter — a cross-tenant `departmentId` simply
matches zero users rather than leaking data.

## Assessment endpoints missing enrollment check — Fixed (High, cross-tenant)
Audited the core training-completion workflow (assessment fetch/submit)
live, since auth/RBAC had been verified but the actual training product
flow had not. `GET /api/assessments/[id]/questions` and
`POST /api/assessments/[id]/submit` checked only that the caller was
*authenticated*, never that they were enrolled in the assessment's
course — confirmed live by fetching another tenant's assessment
questions as an unenrolled employee, which returned the full question
set unauthorized. This let any authenticated user (across tenants) take
any assessment by guessing/discovering its ID and receive a real
certificate for a course they were never assigned, polluting completion
records and risk scores. Fixed by requiring an `Enrollment` row for
`(userId, courseId)` in both routes (403 if absent). Verified live both
directions: an unenrolled user now gets 403, and after creating a real
enrollment the same user successfully receives questions — confirmed via
the running app against the local database, then reverted the test
enrollment. The sibling routes for the same workflow
(`inbox/[id]/open`, `inbox/[id]/report`, `enrollments/[id]/complete`)
were checked too and were already correctly scoped by `userId` in their
query `where` clauses — no change needed there.

## Account deactivation — Fixed (missing integration)
The `User.deletedAt` field was read and filtered on by every single user
query across the app (18 query sites grepped) — implying soft-delete was
designed in — but no route anywhere ever wrote to it. There was no way
for an admin to offboard a departing employee or revoke a compromised
account; the only lifecycle operation available was creation. Added
`DELETE /api/admin/users/[id]` (sets `deletedAt`, blocks self-deactivation,
audit-logged as `USER_DEACTIVATE`) and a "Deactivate" action in
`admin/users/page.tsx`. Verified the write path against the live local
database (soft-delete then revert) and via `tsc`/`lint`/`npm test`/
`npm run build`. Known bounded limitation, not fixed further since it
would require new infrastructure: a deactivated user's *existing* JWT
session remains valid until it expires naturally (max 8h, per the
session-lifetime fix from a prior review pass) rather than being revoked
instantly — acceptable given the short session lifetime and out of scope
for "do not introduce unnecessary features."

## Registration, login, and RBAC redirect flows — Verified live, no issues found
Exercised the full self-registration → login → role-based-redirect flow
end-to-end against the live local database (not just code review):
`GET /api/register/[token]` returns tenant/department data, `POST` creates
the account, a second `POST` with the same email correctly returns 409,
`POST /api/auth/callback/credentials` with the new account's password
returns a valid session cookie, and with that session: `/employee` → 200,
`/admin` → 307 (role-denied redirect), `/login` → 307 (already-authed
redirect away). Security headers (CSP, HSTS, X-Frame-Options, etc. from
`next.config.js`) confirmed present on the auth callback response itself,
not just page loads. No defects found in this flow. Test account cleaned
up afterward.

## Access control / multi-tenancy — Fixed
Every Prisma query site under `src/` (44 files) was enumerated and
individually verified. Eight Critical cross-tenant/cross-manager leaks
were found and fixed across two sweeps this review:
`manager/page.tsx`, `manager/team/page.tsx`, `manager/reports/page.tsx`,
`api/manager/nudge/route.ts`, `api/manager/stats/route.ts`,
`workers/newhire.worker.ts`, `workers/remediation.worker.ts` (the latter
two scope mandatory/remediation course lookups to the enrolling user's
`tenantId`, previously enrolling new hires/failed-simulation users in
*any* tenant's mandatory courses). The remaining ~37 query sites were
read in full and confirmed already correctly scoped. See `SECURITY.md`
A01 for detail.

## Error handling / response consistency — Fixed
16 of 23 API route files had no `try/catch`; an uncaught throw (e.g. an
unexpected Prisma error) would fall through to Next.js's default error
response instead of this app's `{ error: "..." }` JSON contract —
inconsistent with every other route. Added `withApiErrorHandling()` to
`src/lib/api.ts` and wrapped all 18 previously-unguarded exports so every
route now fails in the same shape. Verified via `npm run lint` and
`npm test` (33/33 passing) after the change.

## Performance — Fixed (1 N+1), spot-checked otherwise
`api/admin/courses/[id]/assign/route.ts` looped per-target-user doing a
`findUnique` + `create` + `notification.create` (3 queries × N users) to
bulk-assign a course. Replaced with one batched lookup of existing
enrollments plus `createMany` for both enrollments and notifications.
No other per-row DB-call loops were found in `src/app` or `workers`
(grepped for `for (...) { ... await db.` patterns). Database indexing,
query plans under production-scale load, and bundle-size profiling were
not exercised — this sandbox has no realistic dataset or browser to
profile against; flagged as a follow-up for staging-environment load
testing before launch, not a known defect.

## Accessibility — Partially verified live, one fix; full audit still pending
With the dev server now actually running, did a live walkthrough of the
login page (Tab-key focus order, label association) and found and fixed
the unassociated-label bug above. No `<img>` tags without `alt`
attributes (`src/` grep). Icon-only interactive elements were checked for
label text; the one icon+`<button>` pattern audited
(`src/components/nav.tsx` sign-out button) has adjacent visible text, not
an icon-only control. A full WCAG pass (contrast ratios across all
themed pages, full keyboard-nav trace through every authenticated route,
screen-reader walkthrough) still requires walking the entire authenticated
app with seeded accounts and was not completed in this session — recorded
as a remaining follow-up, not a pass/fail finding.

## Authentication flows beyond session lifetime — Accepted risk (by design)
No MFA, password-reset, or email-verification flow exists. This is a
direct consequence of the platform's explicit no-outbound-mail
architecture (documented in README) — there is no channel to deliver a
reset link, verification code, or MFA OTP. Building one would mean
either (a) wiring an outbound mail/SMS provider, which the README
explicitly discourages for liability reasons and which is a new feature
outside this review's "do not introduce unnecessary features" constraint,
or (b) an in-app-only mechanism with materially weaker security
guarantees than email/SMS-based recovery. Recorded in `SECURITY.md` A07
as an explicit accepted gap with a recommended next step (admin-initiated
password reset, SSO/OIDC) rather than silently omitted.

## Dependency vulnerabilities (npm audit) — Accepted risk, needs sign-off
`next@14.2.35` (latest stable 14.x patch, confirmed via `npm view next
versions`) carries 4 known CVEs (2 moderate, 2 high) that only a
major-version bump to `next@16.x` resolves. This review's explicit
"do not rebuild the project" instruction means this upgrade was not
performed. **This is flagged here as requiring an explicit decision from
the project owner** before launch: either schedule and test a Next.js
major-version migration as a follow-up project, or formally accept the
residual risk for launch. This review does not have the authority to
make that tradeoff unilaterally — it is recorded, not resolved.

## Threat intelligence integration, cross-functional collaboration tooling — Out of scope
The benchmark role description's "threat intelligence integration" (e.g.
ingesting live phishing-indicator feeds to auto-generate simulation
templates) and "cross-functional collaboration" (e.g. Slack/Teams
notification webhooks, ticketing-system integration) describe **new
product features**, not bugs or gaps in the existing implementation.
Building them would directly conflict with this review's "do not rebuild
the project or introduce unnecessary features" instruction. They are
listed in README's "Contributing" section as suggested next steps for
whoever owns the product roadmap, which is the correct venue for a
feature decision — not a security/correctness defect for this review to
silently implement.

## Legal / compliance review — Out of scope
A formal legal/compliance review (data-retention policy, GDPR/CCPA data
subject rights workflow, employee-monitoring consent/disclosure
requirements for a tool that records phishing-test click behavior) is a
legal determination, not an engineering one, and varies by the
deploying organization's jurisdiction. No code change can substitute for
this. Recorded here as a required step before launch that must be
performed by the deploying organization's legal team, not by this
review.

## Cross-browser / responsive UI testing, E2E tests — Infeasible in this sandbox
This sandbox has no real browser matrix and Playwright cannot reach this
app's running dev server in a way that exercises realistic user flows
end-to-end (no persistent dev server, no seeded multi-browser test
matrix). `npm test` covers unit-level validation schemas, CSRF logic,
and the logger. A real E2E suite (Playwright/Cypress against a staging
deploy) and a cross-browser pass (Safari/Firefox/Chrome/mobile viewports)
should be run in CI against a deployed staging environment before launch
— recorded as a deployment-gate follow-up, not performed here.
