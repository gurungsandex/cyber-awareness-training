import { ok, bad, requireAuth, withApiErrorHandling} from "@/lib/api";
import { db } from "@/lib/db";

export const GET = withApiErrorHandling(async () => {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;
  const userId = ctx.user.id;

  const [enrollments, notifications, tip] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: { course: { include: { modules: { include: { lessons: true } } } } },
      orderBy: { assignedAt: "desc" },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.securityTip.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const user = await db.user.findUnique({ where: { id: userId }, select: { riskScore: true, name: true } });

  return ok({ enrollments, notifications, tip, riskScore: user?.riskScore ?? 0 });
});
