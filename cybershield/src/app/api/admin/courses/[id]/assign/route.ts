import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const assignSchema = z.object({
  target: z.enum(["ALL", "DEPARTMENT", "ROLE"]),
  departmentId: z.string().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]).optional(),
  dueInDays: z.number().int().min(1).max(365).default(30),
});

export const POST = withApiErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const course = await db.course.findUnique({ where: { id: params.id } });
  if (!course || (tenantId && course.tenantId !== tenantId)) return bad("Course not found", 404);

  const body = assignSchema.parse(await req.json());
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + body.dueInDays);

  // Build user filter
  const userWhere: any = { deletedAt: null, ...(tenantId ? { tenantId } : {}) };
  if (body.target === "DEPARTMENT" && body.departmentId) {
    userWhere.departmentId = body.departmentId;
  } else if (body.target === "ROLE" && body.role) {
    userWhere.role = body.role;
  }

  const users = await db.user.findMany({ where: userWhere, select: { id: true } });

  const existingEnrollments = await db.enrollment.findMany({
    where: { courseId: params.id, userId: { in: users.map((u) => u.id) } },
    select: { userId: true },
  });
  const alreadyEnrolled = new Set(existingEnrollments.map((e) => e.userId));
  const toEnroll = users.filter((u) => !alreadyEnrolled.has(u.id));

  if (toEnroll.length > 0) {
    await db.enrollment.createMany({
      data: toEnroll.map((u) => ({ userId: u.id, courseId: params.id, dueAt })),
    });
    await db.notification.createMany({
      data: toEnroll.map((u) => ({
        userId: u.id,
        kind: "TRAINING_ASSIGNED",
        title: `New course assigned: ${course.title}`,
        body: `You have been enrolled in "${course.title}". Please complete it within ${body.dueInDays} days.`,
        link: `/employee/courses`,
      })),
    });
  }

  const enrolled = toEnroll.length;
  const skipped = users.length - toEnroll.length;

  await audit(ctx.user.id, "COURSE_ASSIGN", "Course", params.id, {
    enrolled,
    skipped,
    target: body.target,
    departmentId: body.departmentId,
  });

  return ok({ enrolled, skipped, total: users.length });
});
