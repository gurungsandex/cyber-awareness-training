import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/api";

export const POST = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.simulatedInboxItem.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { isRead: true, openedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
