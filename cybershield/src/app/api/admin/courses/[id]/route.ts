import { NextRequest } from "next/server";
import { ok, bad, requireRole, audit, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  retentionCheckEnabled: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurringIntervalMonths: z.number().int().min(1).max(36).optional(),
  deadlineEnforcement: z.enum(["SOFT", "HARD", "ESCALATE"]).optional(),
});

export const PATCH = withApiErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const course = await db.course.findUnique({ where: { id: params.id } });
  if (!course || (tenantId && course.tenantId !== tenantId)) return bad("Course not found", 404);

  const body = updateSchema.parse(await req.json());
  const updated = await db.course.update({ where: { id: params.id }, data: body });

  await audit(ctx.user.id, "COURSE_UPDATE", "Course", params.id, body);
  return ok({ course: { id: updated.id, retentionCheckEnabled: updated.retentionCheckEnabled, isMandatory: updated.isMandatory } });
});
