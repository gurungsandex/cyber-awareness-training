import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  managerId: z.string(),
  courseId: z.string(),
  grant: z.boolean(),
});

export const GET = withApiErrorHandling(async () => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const managers = await db.user.findMany({
    where: { role: "MANAGER", deletedAt: null, ...(tenantId ? { tenantId } : {}) },
    include: {
      department: { select: { name: true } },
      managerGrants: { include: { course: { select: { id: true, title: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return ok({ managers });
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const body = schema.parse(await req.json());

  if (tenantId) {
    const [manager, course] = await Promise.all([
      db.user.findFirst({ where: { id: body.managerId, role: "MANAGER", tenantId } }),
      db.course.findFirst({ where: { id: body.courseId, tenantId } }),
    ]);
    if (!manager || !course) return bad("Manager or course not found", 404);
  }

  if (body.grant) {
    await db.managerGrant.upsert({
      where: { managerId_courseId: { managerId: body.managerId, courseId: body.courseId } },
      update: {},
      create: { managerId: body.managerId, courseId: body.courseId },
    });
    await audit(ctx.user.id, "MANAGER_GRANT_ADD", "ManagerGrant", body.managerId, { courseId: body.courseId });
  } else {
    await db.managerGrant.deleteMany({
      where: { managerId: body.managerId, courseId: body.courseId },
    });
    await audit(ctx.user.id, "MANAGER_GRANT_REMOVE", "ManagerGrant", body.managerId, { courseId: body.courseId });
  }

  return ok({ success: true });
});
