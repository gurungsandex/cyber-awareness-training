import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const dept = await db.department.findUnique({ where: { id: params.id } });
  if (!dept || (tenantId && dept.tenantId !== tenantId)) return bad("Group not found", 404);

  const body = updateSchema.parse(await req.json());
  const updated = await db.department.update({ where: { id: params.id }, data: body });

  await audit(ctx.user.id, "GROUP_UPDATE", "Department", params.id, body);
  return ok({ department: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const dept = await db.department.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!dept || (tenantId && dept.tenantId !== tenantId)) return bad("Group not found", 404);
  if (dept._count.users > 0) return bad("Cannot delete a group that has members. Reassign users first.");

  await db.department.delete({ where: { id: params.id } });
  await audit(ctx.user.id, "GROUP_DELETE", "Department", params.id, { name: dept.name });
  return ok({ deleted: true });
}
