---
name: add-entity
description: Scaffold a new admin-managed CRUD entity end-to-end in the CyberShield house pattern — Prisma model, Zod schemas, API routes, admin page with inline-edit client component, nav entry, and idempotent seed data. Use when asked to add a new manageable "thing" (e.g. locations, vendors, policies, teams).
---

# Add a CRUD entity (the CyberShield way)

This repo grows by cloning one proven pattern: **Departments** (`src/app/admin/departments/*` +
`src/app/api/admin/departments/*`). This skill instantiates that pattern for a new entity so every
layer lands in one pass. Work from `cybershield/`.

Placeholders used below: `{{Entity}}` (PascalCase, e.g. `Vendor`), `{{entity}}` (camel, `vendor`),
`{{entities}}` (plural camel/kebab, `vendors`), `{{ENTITY}}` (SCREAMING, `VENDOR`).

## Step 0 — Decide four things (ask only if the request doesn't say)

1. **Fields** beyond `name` + optional `description` (default to just those).
2. **Who manages it** — default `requireRole("ADMIN")`; use `"MANAGER"` only if explicitly requested.
3. **Delete constraint** — what blocks deletion (Departments block when `_count.users > 0`). Every
   entity needs one stated answer, even if it's "nothing".
4. **Relations** — which existing models point at it.

## Step 1 — Prisma model

Add to `prisma/schema.prisma` next to its nearest relatives, using the section-divider comment style:

```prisma
model {{Entity}} {
  id          String   @id @default(cuid())
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])
}
```

- Add the back-relation array (`{{entities}} {{Entity}}[]`) to `Tenant`.
- Owned children of this entity get `onDelete: Cascade`; references *to* it from other models do not.
- Then: `npx prisma db push && npx prisma generate`. If `db push` warns about destructive changes,
  STOP and ask — that means you renamed or dropped something.

## Step 2 — Zod schemas in `src/lib/validations.ts`

```ts
export const create{{Entity}}Schema = z.object({
  name: z.string().min(1, "Name required").max(100),
  description: z.string().max(500).optional(),
});

export const update{{Entity}}Schema = create{{Entity}}Schema.partial();
```

## Step 3 — API routes

`src/app/api/admin/{{entities}}/route.ts`:

```ts
import { NextRequest } from "next/server";
import { ok, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { create{{Entity}}Schema } from "@/lib/validations";

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const {{entities}} = await db.{{entity}}.findMany({ orderBy: { name: "asc" } });
  return ok({{entities}});
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  try {
    const body = create{{Entity}}Schema.parse(await req.json());
    const {{entity}} = await db.{{entity}}.create({ data: body });
    await audit(ctx.user.id, "{{ENTITY}}_CREATE", "{{Entity}}", {{entity}}.id);
    return ok({{entity}}, 201);
  } catch (e) {
    return handleZodError(e);
  }
}
```

`src/app/api/admin/{{entities}}/[id]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { ok, bad, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { update{{Entity}}Schema } from "@/lib/validations";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  try {
    const body = update{{Entity}}Schema.parse(await req.json());
    const existing = await db.{{entity}}.findUnique({ where: { id: params.id } });
    if (!existing) return bad("Not found", 404);
    const updated = await db.{{entity}}.update({ where: { id: params.id }, data: body });
    await audit(ctx.user.id, "{{ENTITY}}_UPDATE", "{{Entity}}", updated.id);
    return ok(updated);
  } catch (e) {
    return handleZodError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const existing = await db.{{entity}}.findUnique({
    where: { id: params.id },
    // include: { _count: { select: { <blockingRelation>: true } } },
  });
  if (!existing) return bad("Not found", 404);
  // if (existing._count.<blockingRelation> > 0) return bad("Cannot delete — still in use", 409);
  await db.{{entity}}.delete({ where: { id: params.id } });
  await audit(ctx.user.id, "{{ENTITY}}_DELETE", "{{Entity}}", params.id, { name: existing.name });
  return ok({ ok: true });
}
```

Notes that are house law: the `if ("status" in ctx) return ctx;` guard on every handler; Prisma
unique-constraint violations on `@@unique([tenantId, name])` fall through `handleZodError` as a 500 —
if friendly duplicate messages matter, pre-check with `findFirst({ where: { name } })` and
`return bad("A {{entity}} with this name already exists.", 409)`.

## Step 4 — Admin page + client component

`src/app/admin/{{entities}}/page.tsx` (server component — fetch and hand off):

```tsx
import { db } from "@/lib/db";
import { {{Entities}}Client } from "./{{Entities}}Client";

export default async function {{Entities}}Page() {
  const {{entities}} = await db.{{entity}}.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">{{Entities}}</h1>
        <p className="text-sm text-text-muted mt-1">Manage {{entities}} for your organization.</p>
      </div>
      <{{Entities}}Client initial={ {{entities}} } />
    </div>
  );
}
```

`src/app/admin/{{entities}}/{{Entities}}Client.tsx` — **copy
`src/app/admin/departments/DepartmentsClient.tsx` verbatim and rename**. It already implements the
full house pattern: `initial` prop into `useState`, inline table edit with pencil/check/X icon
buttons, create panel behind an "Add" button, `busy`/`error` state, `window.confirm` with the entity
name on delete, error banner (`border-danger/20 bg-danger/5 text-danger`), empty-state row, and the
token-styled table (header `bg-elevated`, `divide-y divide-border`). Change only: the interface,
endpoint paths, labels, and the delete-blocking condition from Step 0.

## Step 5 — Navigation

Add the section to the admin sidebar items in `src/app/admin/layout.tsx`, picking an unused
`lucide-react` icon at `h-4 w-4`. Route is under `/admin/*` so `middleware.ts` already gates it —
no middleware change needed (that's only for routes outside the three role prefixes).

## Step 6 — Seed

In `prisma/seed.ts`, add an idempotent block in the matching section, keyed on stable slug ids:

```ts
async function upsert{{Entity}}(id: string, name: string, description: string) {
  return db.{{entity}}.upsert({
    where: { id },
    update: {},
    create: { id, name, description, tenantId: tenant.id },
  });
}
await upsert{{Entity}}("{{entity}}-example-1", "Example", "Seeded example {{entity}}");
console.log("✅ {{Entities}}");
```

## Step 7 — Verify (all must pass before commit)

```bash
npx tsc --noEmit
npm run lint
npx prisma db seed && npx prisma db seed   # twice — proves idempotency
```

Then exercise it: unauthenticated `curl -i localhost:3000/api/admin/{{entities}}` returns 401; in
the browser as admin — create, rename, delete (and confirm the delete constraint blocks when it
should); check `/admin/audit` shows the three `{{ENTITY}}_*` entries. Commit as
`Feature: {{entities}} management (schema, API, admin UI, seed)`.
