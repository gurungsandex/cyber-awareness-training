import { ok, requireRole } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const [totalUsers, totalCourses, campaigns, enrollments] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { template: true, _count: { select: { interactions: true } } },
    }),
    db.enrollment.findMany({ select: { status: true } }),
  ]);

  const completed = enrollments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;

  const riskScores = await db.user.findMany({
    where: { deletedAt: null, role: "EMPLOYEE" },
    select: { riskScore: true },
  });
  const avgRisk = riskScores.length > 0
    ? Math.round(riskScores.reduce((s, u) => s + u.riskScore, 0) / riskScores.length)
    : 0;

  return ok({ totalUsers, totalCourses, completionRate, avgRisk, campaigns });
}
