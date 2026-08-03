import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const nudgeSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId required"),
  enrollmentId: z.string().optional(),
  nudgeType: z.string().max(40).default("REMINDER"),
  message: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let parsed;
  try {
    parsed = nudgeSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { targetUserId, enrollmentId, nudgeType, message } = parsed;

  const senderId = session.user.id!;

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
