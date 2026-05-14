import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const [deptStats, interactionStats] = await Promise.all([
    db.department.findMany({
      include: {
        users: {
          select: {
            riskScore: true,
            enrollments: { select: { status: true } },
          },
        },
      },
    }),
    db.simulationInteraction.groupBy({
      by: ["action"],
      _count: { action: true },
    }),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Reports</h1>
        <p className="text-text-secondary text-sm mt-1">Platform analytics and security metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Department Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deptStats.map((dept) => {
                const totalUsers = dept.users.length;
                if (totalUsers === 0) return null;
                const avgRisk = Math.round(dept.users.reduce((s, u) => s + u.riskScore, 0) / totalUsers);
                const allEnrollments = dept.users.flatMap((u) => u.enrollments);
                const completed = allEnrollments.filter((e) => e.status === "COMPLETED").length;
                const rate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;
                return (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-text-primary">{dept.name}</span>
                      <span className="text-xs text-text-muted">{totalUsers} users · Risk: {avgRisk}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full">
                      <div className="h-1.5 bg-accent rounded-full transition-all" style={{ width: `${rate}%` }} />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{rate}% completion</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Simulation interactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Simulation Interactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {interactionStats.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">No simulation data yet.</p>
            ) : (
              <div className="space-y-3">
                {interactionStats.map((s) => (
                  <div key={s.action} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-text-secondary capitalize">{s.action.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="font-semibold text-text-primary">{s._count.action}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
