import { ok, requireRole, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";

export const GET = withApiErrorHandling(async () => {
  const ctx = await requireRole("MANAGER");
  if ("status" in ctx) return ctx;
  const role = (ctx.user as any).role;
  const tenantId = (ctx.user as any).tenantId ?? null;

  const manager = role === "MANAGER" ? await db.user.findUnique({ where: { id: ctx.user.id }, select: { departmentId: true } }) : null;

  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      role: "EMPLOYEE",
      ...(tenantId ? { tenantId } : {}),
      ...(role === "MANAGER" ? { departmentId: manager?.departmentId ?? "__none__" } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      riskScore: true,
      department: true,
      enrollments: { select: { status: true } },
    },
    orderBy: { riskScore: "desc" },
  });

  const totalUsers = users.length;
  const atRisk = users.filter((u) => u.riskScore >= 40).length;
  const allEnrollments = users.flatMap((u) => u.enrollments);
  const completed = allEnrollments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;

  return ok({ totalUsers, atRisk, completionRate, users });
});
