import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, Siren, TrendingUp, TrendingDown, Activity } from "lucide-react";

function campaignStatusVariant(status: string): "secondary" | "default" | "success" | "destructive" | "warning" | "outline" {
  const map: Record<string, any> = {
    DRAFT: "outline", SCHEDULED: "secondary", RUNNING: "default",
    COMPLETED: "success", CANCELLED: "destructive",
  };
  return map[status] ?? "secondary";
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/login");

  const [totalUsers, totalCourses, enrollments, campaigns, recentAudit] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.enrollment.findMany({ select: { status: true } }),
    db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { template: true, _count: { select: { interactions: true } } },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform overview and management.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: totalUsers, icon: <Users className="h-5 w-5 text-blue-600" />, bg: "bg-blue-50" },
          { label: "Published Courses", value: totalCourses, icon: <BookOpen className="h-5 w-5 text-green-600" />, bg: "bg-green-50" },
          { label: "Completion Rate", value: `${completionRate}%`, icon: <TrendingUp className="h-5 w-5 text-brand-600" />, bg: "bg-brand-50" },
          { label: "Avg Risk Score", value: avgRisk, icon: <Activity className="h-5 w-5 text-orange-600" />, bg: "bg-orange-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-brand-600" />
                Recent Campaigns
              </CardTitle>
              <Link href="/admin/campaigns" className="text-sm text-brand-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No campaigns yet.</p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.template.type} · {c._count.interactions} interactions ·{" "}
                          {new Date(c.scheduledAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={campaignStatusVariant(c.status)}>{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Audit log */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-gray-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAudit.map((log) => (
                  <div key={log.id} className="text-sm">
                    <p className="font-medium text-gray-800">{log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400">
                      {log.user?.name ?? "System"} · {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
                {recentAudit.length === 0 && (
                  <p className="text-sm text-gray-400">No activity yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
