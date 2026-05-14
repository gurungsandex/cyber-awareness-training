import { NextRequest } from "next/server";
import { ok, bad, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;
  await db.notification.updateMany({
    where: { id: params.id, userId: ctx.user.id },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
}
