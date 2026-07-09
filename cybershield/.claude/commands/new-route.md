# /new-route — Scaffold a correctly-structured API route

Generates a new API route handler that satisfies every quality criterion in
CLAUDE.md without having to reconstruct the pattern from scratch.

## When to use

When adding a new endpoint under `src/app/api/`. Avoids the most common
mistakes: missing requireRole check, wrong tenant scoping for Course
queries, missing audit(), forgotten withApiErrorHandling wrapper.

## What you need before starting

- **Route path** — e.g. `src/app/api/admin/groups/[id]/members/route.ts`
- **HTTP method(s)** — GET / POST / PATCH / DELETE
- **Minimum role** — ADMIN or MANAGER (MANAGER also allows ADMIN)
- **Models touched** — which Prisma models this route reads or writes
- **Action name** — what to write in the audit log, e.g. `GROUP_MEMBER_ADD`

## Steps

### 1. Determine the route's authorization model

Is this route accessible to ADMIN only, or also to MANAGER?

- ADMIN only → `requireRole("ADMIN")`
- Both → `requireRole("MANAGER")`

If this route acts on a specific Course and a MANAGER can call it, you
also need a ManagerGrant check (see CLAUDE.md §2 "Manager grant check").

### 2. Determine the tenant scoping pattern

Which models does this route query?

- `User`, `Department`, `Campaign`, `Enrollment`, `AuditLog`, `Notification`,
  `CourseGroup`, `Badge`, `NudgeLog` → direct column, use `...tenantFilter`
- **`Course`** or **`SimulationTemplate`** → nullable `tenantId`, must use
  `...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {})`
- Models without a direct `tenantId` (Enrollment, SimulationInteraction) →
  scope through a relation: `where: { user: tenantFilter }` or
  `where: { campaign: tenantFilter }`

### 3. Write the Zod schema

Add it to `src/lib/validations.ts` if it will be reused, or define it
inline in the route file if it is route-specific. Every mutation must have
one; GET routes that accept query params should validate those too.

```ts
const mySchema = z.object({
  name: z.string().min(1),
  // ...
});
```

### 4. Write the route using the standard template

**Template for a mutation (POST/PATCH/DELETE):**

```ts
import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit, withApiErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const mySchema = z.object({
  // ...
});

export const POST = withApiErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await requireRole("ADMIN");   // or "MANAGER"
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  // For Course/SimulationTemplate reads:
  const item = await db.course.findUnique({ where: { id: params.id } });
  if (!item || (tenantId && item.tenantId && item.tenantId !== tenantId)) {
    return bad("Not found", 404);
  }

  // For MANAGER callers acting on a course:
  if ((ctx.user as any).role === "MANAGER") {
    const grant = await db.managerGrant.findUnique({
      where: { managerId_courseId: { managerId: ctx.user.id!, courseId: params.id } },
    });
    if (!grant) return bad("Forbidden", 403);
  }

  const body = mySchema.parse(await req.json());

  // ... db mutations ...

  await audit(ctx.user.id!, "ACTION_NAME", "EntityName", params.id, { /* extra metadata */ });
  return ok(result, 201);
});
```

**Template for a read (GET):**

```ts
export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const items = await db.someModel.findMany({
    where: {
      // For Course/SimulationTemplate:
      ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}),
      // For everything else:
      ...(tenantId ? { tenantId } : {}),
    },
    // Never include passwordHash in the select/include
    select: { id: true, name: true, /* ... */ },
    orderBy: { createdAt: "desc" },
  });

  return ok(items);
}
```

### 5. Verify the checklist

Before considering the route done:

- [ ] `requireRole` at top; `"status" in ctx` checked immediately after
- [ ] `tenantId` extracted from `ctx.user`; present in every query's `where`
- [ ] Course/SimulationTemplate reads use `OR: [{ tenantId }, { tenantId: null }]`
- [ ] MANAGER callers acting on courses have ManagerGrant check
- [ ] No `passwordHash` in any response (check all `include: { user: ... }`)
- [ ] Request body goes through Zod before reaching the database
- [ ] `audit()` called for every mutation
- [ ] Wrapped in `withApiErrorHandling` (mutations) or has try/catch
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero warnings

### 6. Register the route file

Create `src/app/api/YOUR_PATH/route.ts`. Next.js discovers it automatically.
No registration step required.

### 7. Verify live

Run `/verify` against the new route.
