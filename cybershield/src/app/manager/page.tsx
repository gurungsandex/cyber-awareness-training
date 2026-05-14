import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function ManagerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = await db.user.findMany({
    where: { deletedAt: null, role: "EMPLOYEE" },
    include: {
      department: true,
      enrollments: { select: { status: true } },
    },
    orderBy: { riskScore: "desc" },
    take: 10,
  });

  const totalUsers = users.length;
  const atRisk = users.filter((u) => u.riskScore >= 40).length;
  const allEnrollments = users.flatMap((u) => u.enrollments);
  const completed = allEnrollments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-gray-500 mt-1">Your team&apos;s security awareness overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">At Risk</p>
                <p className="text-2xl font-bold text-gray-900">{atRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            Team Members
          </CardTitle>
          <Link href="/manager/team" className="text-sm text-brand-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Department", "Risk Score", "Completion", "Status"].map((h) => (
                    <th key={h} className="text-left py-3 pr-4 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const total = u.enrollments.length;
                  const done = u.enrollments.filter((e) => e.status === "COMPLETED").length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                      <td className="py-3 pr-4 text-gray-500">{u.department?.name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={`font-semibold ${u.riskScore >= 70 ? "text-red-600" : u.riskScore >= 40 ? "text-yellow-600" : "text-green-600"}`}>
                          {u.riskScore}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        {u.riskScore >= 70 ? (
                          <Badge variant="destructive">High Risk</Badge>
                        ) : u.riskScore >= 40 ? (
                          <Badge variant="warning">Medium Risk</Badge>
                        ) : (
                          <Badge variant="success">Low Risk</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
