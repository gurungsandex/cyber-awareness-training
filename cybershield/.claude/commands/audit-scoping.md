# /audit-scoping — Audit all Prisma query sites for tenant and data-safety issues

Systematically scans every Prisma call site in `src/` for the three
classes of defect that have been found most often in this codebase:

1. **Nullable tenantId trap** — `Course` or `SimulationTemplate` queries
   filtered with `{ tenantId }` instead of `{ OR: [{ tenantId }, { tenantId: null }] }`.
2. **passwordHash exposure** — `User` queries returned without stripping
   the `passwordHash` field.
3. **managerId scoping** — Manager views that filter employees by
   `managerId` (a field that is never populated).

Run this skill any time you modify a Prisma query, add a new query site,
or suspect a data-visibility issue. It takes ~2 minutes and has caught
at least six production-severity bugs in this codebase.

## Steps

### Step 1 — Find all Course query sites

```bash
grep -rn "db\.course\." \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx"
```

For each result, open the file at that line and check the `where` clause:

**FAIL** (must fix):
```ts
where: { status: "PUBLISHED", ...tenantFilter }
where: { tenantId }
where: { ...tenantFilter }
```

**PASS** (correct):
```ts
where: { ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}) }
where: {}  // no tenant filter — acceptable only when tenantId is always null (single-tenant)
```

For any FAIL result, apply the fix:
```ts
// Replace:
where: { status: "PUBLISHED", ...tenantFilter }

// With:
where: {
  status: "PUBLISHED",
  ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}),
}
```

### Step 2 — Find all SimulationTemplate query sites

```bash
grep -rn "db\.simulationTemplate\." \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx"
```

Apply the same OR-null check as Step 1. The reference implementation is
`src/app/api/admin/campaigns/route.ts`:
```ts
if (!template || (tenantId && template.tenantId && template.tenantId !== tenantId)) {
  return bad("Invalid template", 400);
}
```

### Step 3 — Find User queries that might expose passwordHash

```bash
grep -rn "db\.user\." \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "findUnique\s*({.*select\|findMany\s*({.*select\|count("
```

This surfaces `findMany`/`findFirst`/`findUnique` calls that do NOT use a
`select` (and therefore return all fields including `passwordHash`).

For each result: does the query result reach a response body?
- If yes and no `select` → add a `select` that omits `passwordHash`, or
  add `.map((u) => ({ ...u, passwordHash: undefined }))` before returning.
- If the result is only used for an existence check or a single field read
  and never serialized → OK.

Also run:
```bash
grep -rn "passwordHash" \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "passwordHash.*undefined\|select.*false\|hash\|bcrypt"
```

Any occurrence that is not in a write path or an explicit `undefined`
stripping is a potential exposure. Investigate it.

### Step 4 — Find managerId scoping in manager pages

```bash
grep -rn "managerId" \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx"
```

`managerId` appears in the Prisma schema as a nullable self-relation on
`User`. It is legitimately referenced in the schema and in the
`ManagerGrant` model. What is NOT legitimate is using it as a `where`
filter in manager-view queries:

**FAIL:**
```ts
where: { managerId: session.user.id }
where: { managerId: currentUserId }
```

**PASS (legitimate uses):**
```ts
// Reading it as a field (schema / type reference):
user.managerId
// In ManagerGrant queries (unrelated to the self-relation):
db.managerGrant.findUnique({ where: { managerId_courseId: { managerId, courseId } } })
```

For any FAIL: replace with `departmentId` scoping. See
`src/app/manager/page.tsx` for the reference implementation.

### Step 5 — Spot-check a non-trivially-scoped enrollment query

Enrollment doesn't have a direct `tenantId`, so it scopes through `user`.
Verify any `db.enrollment.findMany` uses `where: { user: tenantFilter }`:

```bash
grep -rn "db\.enrollment\." \
  /home/user/cyber-awareness-training/cybershield/src/ \
  --include="*.ts" --include="*.tsx"
```

Each result should either:
- Not filter by tenant at all (acceptable for employee-owned data scoped by `userId`)
- Use `where: { user: tenantFilter }` or `where: { userId: ..., user: tenantFilter }`
- Never use `where: { tenantId: ... }` (column doesn't exist on Enrollment)

### Step 6 — Summarize findings

For each defect found:
1. Name the file and line number.
2. Quote the failing pattern.
3. Apply the fix (matching the pattern in CLAUDE.md §2).
4. After all fixes: `npx tsc --noEmit && npm run lint && npm test`.

If zero defects found in all five steps, state that explicitly.
