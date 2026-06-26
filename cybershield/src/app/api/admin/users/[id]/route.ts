import { ok, bad, requireRole, audit, withApiErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const DELETE = withApiErrorHandling(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target || target.deletedAt || (tenantId && target.tenantId !== tenantId)) {
    return bad("Not found", 404);
  }
  if (target.id === ctx.user.id) {
    return bad("Cannot deactivate your own account", 400);
  }

  await db.user.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await audit(ctx.user.id, "USER_DEACTIVATE", "User", target.id);
  return ok({ ok: true });
});
