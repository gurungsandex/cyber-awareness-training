import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const assignSchema = z.object({
  target: z.enum(["ALL", "DEPARTMENT", "ROLE"]),
  departmentId: z.string().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]).optional(),
  dueInDays: z.number().int().min(1).max(365).default(30),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const course = await db.course.findUnique({ where: { id: params.id } });
  if (!course) return bad("Course not found", 404);

  const body = assignSchema.parse(await req.json());
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + body.dueInDays);

  // Build user filter
  const userWhere: any = { deletedAt: null };
  if (body.target === "DEPARTMENT" && body.departmentId) {
    userWhere.departmentId = body.departmentId;
  } else if (body.target === "ROLE" && body.role) {
    userWhere.role = body.role;
  }

  const users = await db.user.findMany({ where: userWhere, select: { id: true } });

  let enrolled = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: params.id } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.enrollment.create({
      data: { userId: user.id, courseId: params.id, dueAt },
    });
    // Notify the user
    await db.notification.create({
      data: {
        userId: user.id,
        kind: "TRAINING_ASSIGNED",
        title: `New course assigned: ${course.title}`,
        body: `You have been enrolled in "${course.title}". Please complete it within ${body.dueInDays} days.`,
        link: `/employee/courses`,
      },
    });
    enrolled++;
  }

  await audit(ctx.user.id, "COURSE_ASSIGN", "Course", params.id, {
    enrolled,
    skipped,
    target: body.target,
    departmentId: body.departmentId,
  });

  return ok({ enrolled, skipped, total: users.length });
}
