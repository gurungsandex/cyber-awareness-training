import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  managerId: z.string(),
  courseId: z.string(),
  grant: z.boolean(),
});

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const managers = await db.user.findMany({
    where: { role: "MANAGER", deletedAt: null },
    include: {
      department: { select: { name: true } },
      managerGrants: { include: { course: { select: { id: true, title: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return ok({ managers });
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const body = schema.parse(await req.json());

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
}
