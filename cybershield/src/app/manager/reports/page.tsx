import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default async function ManagerReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departments = await db.department.findMany({
    include: {
      users: {
        where: { role: "EMPLOYEE", deletedAt: null },
        select: {
          riskScore: true,
          enrollments: { select: { status: true } },
        },
      },
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Team security awareness metrics by department.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              Department Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {departments.map((d) => {
                const total = d.users.length;
                if (total === 0) return null;
                const avgRisk = Math.round(d.users.reduce((s, u) => s + u.riskScore, 0) / total);
                const enrollments = d.users.flatMap((u) => u.enrollments);
                const done = enrollments.filter((e) => e.status === "COMPLETED").length;
                const pct = enrollments.length > 0 ? Math.round((done / enrollments.length) * 100) : 0;
                return (
                  <div key={d.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{d.name}</span>
                      <span className="text-xs text-gray-400">{total} users · Avg risk {avgRisk}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-3 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{pct}% completion ({done}/{enrollments.length})</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
