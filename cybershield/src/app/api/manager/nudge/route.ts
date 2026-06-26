import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { targetUserId, enrollmentId, nudgeType = "REMINDER", message } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });

  const senderId = session.user.id!;

  const target = await db.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (!target) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  if (role === "MANAGER" && target.managerId !== senderId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.$transaction([
    db.nudgeLog.create({
      data: { senderId, targetUserId, enrollmentId, nudgeType, message },
    }),
    db.notification.create({
      data: {
        userId: targetUserId,
        kind: "NUDGE_RECEIVED",
        title: "Reminder from your manager",
        body: message ?? "Your manager is reminding you to complete your security training.",
        link: "/employee/courses",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
