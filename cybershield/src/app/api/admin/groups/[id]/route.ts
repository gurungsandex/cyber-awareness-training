import { NextRequest } from "next/server";
import { ok, bad, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const dept = await db.department.findFirst({ where: { id: params.id, tenantId: ctx.user.tenantId ?? null } });
  if (!dept) return bad("Group not found", 404);

  let body: z.infer<typeof updateSchema>;
  try {
    body = updateSchema.parse(await req.json());
  } catch (e) {
    return handleZodError(e);
  }
  const updated = await db.department.update({ where: { id: params.id }, data: body });

  await audit(ctx.user.id, "GROUP_UPDATE", "Department", params.id, body);
  return ok({ department: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const dept = await db.department.findFirst({
    where: { id: params.id, tenantId: ctx.user.tenantId ?? null },
    include: { _count: { select: { users: true } } },
  });
  if (!dept) return bad("Group not found", 404);
  if (dept._count.users > 0) return bad("Cannot delete a group that has members. Reassign users first.");

  await db.department.delete({ where: { id: params.id } });
  await audit(ctx.user.id, "GROUP_DELETE", "Department", params.id, { name: dept.name });
  return ok({ deleted: true });
}
