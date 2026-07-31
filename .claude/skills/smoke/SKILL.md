---
name: smoke
description: Stand up the full CyberShield stack (Postgres, Redis, web, workers, seed) and run a scripted end-to-end smoke of the critical seeded flows — login per role, course completion, assessment scoring, phishing inbox, campaign delivery, certificate issue. Run before pushing anything that touches auth, middleware, API routes, schema, queues, or workers. This repo has no test suite; this is the regression gate.
---

# Smoke-test CyberShield end-to-end

Everything runs from `cybershield/`. The goal is observed behavior, not green typechecks: log in as
each role, complete a course, fail/report a phish, and watch a worker consume a job.

## Step 1 — Infrastructure

Check what's already up before starting anything: `pg_isready -h localhost -p 5432` and
`redis-cli ping`. If missing and Docker is available:

```bash
docker run -d --name cs-pg -e POSTGRES_USER=cybershield -e POSTGRES_PASSWORD=cybershield \
  -e POSTGRES_DB=cybershield -p 5432:5432 postgres:16-alpine
docker run -d --name cs-redis -p 6379:6379 redis:7-alpine
```

If Docker is unavailable, install/start local `postgresql` and `redis-server` instead. Redis being
absent is survivable (queue adds are `.catch(() => {})`-wrapped) but then campaign delivery,
remediation, and certificates **cannot** be verified — say so in your report rather than skipping
silently.

Ensure env (create `cybershield/.env` if missing — there is no `.env.example` despite the README):

```
DATABASE_URL=postgresql://cybershield:cybershield@localhost:5432/cybershield
NEXTAUTH_SECRET=dev-smoke-secret-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Step 2 — Schema, seed, processes

```bash
npm install                      # if node_modules missing
npx prisma db push               # NOT migrate — no migrations dir exists
npx prisma db seed
npm run dev        # background task 1 — wait for "Ready" on :3000
npm run workers:dev # background task 2 — wait for "⚡ CyberShield workers starting"
```

Run both via Bash `run_in_background: true` and confirm readiness from their output before testing.

## Step 3 — The smoke script

Playwright + Chromium are preinstalled in this environment
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Session flows need real cookies, so use the browser —
don't fight NextAuth CSRF with curl. Write this to the scratchpad and run it with
`npx tsx <scratchpad>/smoke.ts` (tsx is a devDependency; playwright core is available via the
preinstalled tooling — if `import("playwright")` fails, `npm i -D playwright` is an acceptable
dev-dep, per CLAUDE.md escalation rules):

```ts
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, note?: string) => {
  results.push([name, ok, note]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` — ${note}` : ""}`);
};

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|manager|employee)/, { timeout: 15000 });
  return page.url();
}

(async () => {
  const browser = await chromium.launch();

  // ── 1. Role logins land on the right dashboards ──────────────────────────
  for (const [email, pw, home] of [
    ["admin@cybershield.local", "ChangeMe!2026", "/admin"],
    ["manager@cybershield.local", "Manager!2026", "/manager"],
    ["alice.chen@cybershield.local", "Employee!2026", "/employee"],
  ] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const url = await login(page, email, pw);
      check(`login ${email}`, url.includes(home), url);
    } catch (e: any) { check(`login ${email}`, false, e.message); }
    await ctx.close();
  }

  // ── 2. Role gating: employee must not reach /admin ───────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "alice.chen@cybershield.local", "Employee!2026");
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState("networkidle");
    check("employee blocked from /admin", !page.url().includes("/admin"), page.url());
    await ctx.close();
  }

  // ── 3. Admin: launch a campaign scheduled now ─────────────────────────────
  const admin = await browser.newContext();
  {
    const page = await admin.newPage();
    await login(page, "admin@cybershield.local", "ChangeMe!2026");
    const templates = await page.evaluate(async () => {
      // template list comes from the campaigns page's server data; fall back to picking via API-less DOM if needed
      return null;
    });
    // Create via API from the authenticated context (cookies carry the session):
    const tmplRes = await page.request.get(`${BASE}/api/admin/campaigns`);
    check("GET /api/admin/campaigns as admin", tmplRes.ok(), String(tmplRes.status()));
    // Grab a seeded template id straight from the DB-backed page:
    await page.goto(`${BASE}/admin/campaigns`);
    const createRes = await page.request.post(`${BASE}/api/admin/campaigns`, {
      data: {
        name: `Smoke ${Date.now()}`,
        templateId: await page.evaluate(async () => {
          const r = await fetch("/api/admin/campaigns"); const c = await r.json();
          return c[0]?.templateId ?? c[0]?.template?.id ?? "";
        }),
        scheduledAt: new Date(Date.now() + 2000).toISOString(),
        targets: [{ allUsers: true }],
      },
    });
    check("POST campaign (201)", createRes.status() === 201, String(createRes.status()));
  }

  // ── 4. Worker consumes the launch job (needs workers:dev + redis) ─────────
  await new Promise((r) => setTimeout(r, 8000)); // give BullMQ the delayed job
  {
    const page = await admin.newPage();
    const res = await page.request.get(`${BASE}/api/admin/campaigns`);
    const campaigns = await res.json();
    const mine = campaigns.find((c: any) => c.name.startsWith("Smoke "));
    check("campaign RUNNING after worker pickup", mine?.status === "RUNNING", mine?.status);
  }

  // ── 5. Employee: unauthenticated API returns 401 ──────────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.get(`${BASE}/api/employee/dashboard`);
    check("unauthenticated API → 401", res.status() === 401, String(res.status()));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
```

Adapt selectors/flows if the UI changed — the script is a starting template, not a fixture. When the
change under test touches a specific flow (e.g. assessments), extend the script to drive that flow:
enroll → open course → complete lessons → submit assessment → assert `passed`/`scorePct` in the
response and (with workers up) a new row on `/employee/certificates`.

## Step 4 — Interpret and report

- **Pass** = every check green, plus no unexpected errors in the `npm run dev` / `workers:dev`
  output (warnings about Redis are expected only if Redis is deliberately down).
- Report results as a pass/fail list with the failing check's evidence (status code, URL, worker log
  line). A failing smoke on code you changed means fix-and-rerun, not report-and-stop.
- **Cleanup:** kill both background tasks; remove `cs-pg`/`cs-redis` containers only if you created
  them this session. Smoke-created campaigns (named `Smoke <timestamp>`) may be left — they're in a
  dev database.

## Known traps

- Login submit button: it's the only `type="submit"` on `/login` (see `LoginForm.tsx`) — prefer role/
  text selectors if this fails.
- Campaign status stays `SCHEDULED` forever when `workers:dev` isn't running or Redis is down —
  that's an environment failure, not an app bug; distinguish them in the report.
- First `next dev` compile of a page is slow; use generous `waitForURL` timeouts (15s+).
