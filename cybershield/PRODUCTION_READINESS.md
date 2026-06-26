# Production readiness — audit status

Itemized status against the full audit checklist used for this review.
Each item is marked **Fixed** (with evidence), **Verified clean** (audited,
no issue found), **Accepted risk** (known gap, deliberately not built —
see rationale), or **Out of scope for this review** (requires a decision
this review cannot make autonomously: legal sign-off, a new feature, or
infrastructure this sandbox cannot exercise).

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

## Accessibility — Spot-checked, no violations found
No `<img>` tags without `alt` attributes (`src/` grep). Icon-only
interactive elements were checked for label text; the one icon+`<button>`
pattern audited (`src/components/nav.tsx` sign-out button) has adjacent
visible text, not an icon-only control. Full WCAG conformance (contrast
ratios, full keyboard-nav trace, screen-reader walkthrough) requires a
running browser session against the live app and was not performed in
this sandbox — recorded as **out of scope for this review**, not as a
pass/fail finding.

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
