# Security review — OWASP Top 10 (2021) mapping

This document maps CyberShield's actual implementation to the OWASP Top 10,
with file-level evidence. It was produced as part of a pre-production
security audit and reflects the state of the codebase at the time of
writing, not aspirational controls.

## A01:2021 – Broken Access Control

- **Multi-tenant isolation.** Every admin/manager Prisma query is scoped by
  the caller's `tenantId` (nullable, so single-tenant installs are
  unaffected). Scoping is applied either directly (`where: { tenantId }`)
  or via relation (`where: { user: { tenantId } }`,
  `where: { campaign: { tenantId } }`) for models without a direct column.
  This was audited file-by-file across every Prisma call site under `src/`
  (44 files) during this review. Five Critical cross-tenant/cross-manager
  leaks were found and fixed:
  `src/app/manager/page.tsx`, `src/app/manager/team/page.tsx`,
  `src/app/manager/reports/page.tsx`, `src/app/api/manager/nudge/route.ts`,
  `src/app/api/manager/stats/route.ts`. The remaining 39 query sites
  (all admin API routes, `admin/reports`, `admin/templates`,
  `manager/courses`, `manager/my-training`, manager-grants, departments,
  groups, campaigns) were confirmed already correctly scoped.
- **Manager scoping layered on tenant scoping.** MANAGER role additionally
  filters by `managerId` so a manager only sees direct reports, never the
  whole tenant — verified present alongside tenant scoping on every manager
  surface listed above.
- **Role gating** is enforced centrally in `src/middleware.ts` and via
  `requireRole()` in `src/lib/api.ts` for API routes.
- **Known gap (by design, not a vulnerability):** there is no API/UI to
  edit or delete an individual user after creation (`src/app/api/admin/users/route.ts`
  only implements `GET`/`POST`). The README previously claimed "Full CRUD"
  and "last-admin protection" for this surface — both claims were false
  (zero matching code, confirmed via grep) and have been corrected in
  `README.md` to describe actual behavior rather than building the missing
  feature, per this review's scope (audit and fix, not add new features).

## A02:2021 – Cryptographic Failures

- Passwords are hashed with `bcryptjs` (`src/lib/auth.ts`), never stored or
  logged in plaintext.
- The fake phishing login page only ever transmits `usernameLength`/
  `passwordLength` to the server — actual credential values never leave
  the browser (see README "Security & privacy notes").
- Sessions are signed JWTs (NextAuth, `NEXTAUTH_SECRET`), `maxAge` fixed
  this review to `8 * 60 * 60` seconds to match the documented 8h session
  lifetime (previously defaulted to NextAuth's 30-day default — a
  Critical fix, `src/lib/auth.ts`).

## A03:2021 – Injection

- All database access goes through Prisma's parameterized query builder —
  no raw/string-interpolated SQL anywhere in `src/`.
- Request bodies are validated with `zod` schemas before use (9 files
  under `src/lib/validations*` and `src/app/api`), rejecting malformed/
  unexpected input before it reaches the database layer.

## A04:2021 – Insecure Design

- No outbound email/SMS — phishing simulations are delivered entirely
  in-app (`/employee/inbox`), eliminating the risk of a real-world
  phishing payload escaping the platform. This is a deliberate design
  constraint, not a gap.
- No file-upload endpoints exist anywhere under `src/app/api` (confirmed
  via glob `**/upload*/**`), so there is no unrestricted-file-upload
  attack surface to harden.

## A05:2021 – Security Misconfiguration

- Security headers (`next.config.js`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HSTS,
  2yr + preload), `Referrer-Policy`, `Permissions-Policy`, and a
  restrictive `Content-Security-Policy` (`default-src 'self'`,
  `frame-ancestors 'none'`, `form-action 'self'`).
- `npm audit --omit=dev` (run this review) reports 4 vulnerabilities
  (2 moderate, 2 high), all transitively rooted in `next@14.2.35` —
  already the latest stable patch release in the 14.x line (verified via
  `npm view next versions`; no non-breaking update exists). Full
  remediation requires `next@16.x`, which `npm audit fix --force` confirms
  is a breaking major-version upgrade. Given this review's explicit
  "do not rebuild the project" constraint, this is recorded as a known,
  **accepted residual risk** rather than silently patched — a planned
  Next.js major-version migration should be scheduled separately and
  tested in full before production cutover.

## A06:2021 – Vulnerable and Outdated Components

- Same finding as A05: `next@14.2.35` is current within its major line;
  the only fix is the major upgrade tracked above. No other dependency
  vulnerabilities were reported by `npm audit --omit=dev`.

## A07:2021 – Identification and Authentication Failures

- Login rate limiting: Redis-backed counter (`login_attempts:<email>`),
  5 attempts per 15-minute window, fails open if Redis is unreachable
  (`src/lib/auth.ts`).
- Credentials provider only — no MFA, password-reset, or email-verification
  flow exists. This is consistent with the platform's no-outbound-mail
  design (there is no channel to deliver a reset link or verification
  code), and is documented here as an explicit accepted gap rather than a
  silent omission. Recommendation for production: provision an admin-only
  "force password reset" action and an SSO/OIDC option, both noted as
  contributing-next-steps in `README.md`.

## A08:2021 – Software and Data Integrity Failures

- `npm ci` (lockfile-pinned installs) is used in CI (`.github/workflows/ci.yml`),
  preventing unpinned dependency drift on build.
- See A05/A06 for the one outstanding dependency-integrity item (Next.js
  major-version CVEs).

## A09:2021 – Security Logging and Monitoring Failures

- Privileged mutations (user creation, course changes, campaign launches,
  assessment submissions) write to a structured `AuditLog` table via
  `src/lib/api.ts`, surfaced in `/admin/audit`.
- Unhandled API errors and audit-log write failures emit structured JSON
  logs (`src/lib/logger.ts`) intended to be piped to an external log
  aggregator in production; no SIEM/alerting integration is wired in by
  default (documented in README as a contributing-next-step).

## A10:2021 – Server-Side Request Forgery (SSRF)

- No outbound `fetch()` calls exist in `src/lib` or `src/app/api` (grepped
  this review), so there is no server-initiated-request surface for an
  attacker-controlled URL to reach. The only external network call is to
  the Anthropic API for optional AI content generation, with a fixed,
  hardcoded endpoint — not driven by user-supplied input.

## CSRF (cross-cutting, not a numbered 2021 category but tested for)

- `src/lib/csrf.ts` rejects state-changing API requests (`POST`/`PUT`/
  `PATCH`/`DELETE`) whose `Origin` header doesn't match the request host,
  layered on top of NextAuth's `SameSite=Lax` session cookie. Covered by
  `src/lib/csrf.test.ts`.
