import { NextRequest } from "next/server";
import { ok, bad, requireAuth, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";

export const POST = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;
  await db.notification.updateMany({
    where: { id: params.id, userId: ctx.user.id },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
});
