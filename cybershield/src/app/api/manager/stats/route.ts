import { ok, requireRole } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await requireRole("MANAGER");
  if ("status" in ctx) return ctx;
  const role = (ctx.user as any).role;

  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      role: "EMPLOYEE",
      ...(role === "MANAGER" ? { managerId: ctx.user.id } : {}),
    },
    include: {
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
}
