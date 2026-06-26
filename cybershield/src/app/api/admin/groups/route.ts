import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const departments = await db.department.findMany({
    where: tenantId ? { tenantId } : {},
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return ok({ departments });
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const body = createSchema.parse(await req.json());

  const existing = await db.department.findFirst({ where: { name: body.name, tenantId } });
  if (existing) return bad("A group with this name already exists.");

  const dept = await db.department.create({
    data: { name: body.name, description: body.description, tenantId },
  });

  await audit(ctx.user.id, "GROUP_CREATE", "Department", dept.id, { name: body.name });
  return ok({ department: dept });
}
