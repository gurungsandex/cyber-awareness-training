import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/RiskGauge";
import { Users, BookOpen, Siren, TrendingUp, Activity, ShieldCheck, AlertTriangle } from "lucide-react";

function campaignStatusVariant(s: string): any {
  const m: Record<string, string> = {
    DRAFT: "outline", SCHEDULED: "secondary", RUNNING: "default",
    COMPLETED: "success", CANCELLED: "destructive",
  };
  return m[s] ?? "secondary";
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/login");
  const tenantId = (session.user as any).tenantId ?? null;
  const tenantFilter = tenantId ? { tenantId } : {};

  const [totalUsers, totalCourses, enrollments, campaigns, recentAudit, riskScores, overdue] = await Promise.all([
    db.user.count({ where: { deletedAt: null, ...tenantFilter } }),
    db.course.count({ where: { status: "PUBLISHED", ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}) } }),
    db.enrollment.findMany({ where: { user: tenantFilter }, select: { status: true } }),
    db.campaign.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { template: true, _count: { select: { interactions: true } } },
    }),
    db.auditLog.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { deletedAt: null, role: "EMPLOYEE", ...tenantFilter },
      select: { riskScore: true },
    }),
    db.enrollment.count({
      where: { dueAt: { lt: new Date() }, status: { notIn: ["COMPLETED"] }, user: tenantFilter },
    }),
  ]);

  const completed = enrollments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;
  const avgRisk = riskScores.length > 0
    ? Math.round(riskScores.reduce((s, u) => s + u.riskScore, 0) / riskScores.length)
    : 0;
  const highRiskCount = riskScores.filter((u) => u.riskScore > 60).length;

  const stats = [
    { label: "Total Employees", value: totalUsers, icon: Users, color: "text-accent", bg: "bg-accent/10" },
    { label: "Active Courses", value: totalCourses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
    { label: "Completion Rate", value: `${completionRate}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, color: "text-danger", bg: "bg-danger/10" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">Admin Overview</h1>
        <p className="text-text-secondary text-sm mt-1">Security posture across your organisation.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${s.bg} flex-shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-heading font-bold text-text-primary">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Risk Gauge */}
        <Card className="flex flex-col items-center justify-center py-6 gap-2">
          <CardHeader className="pb-2 pt-0 px-5 w-full">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Org Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-4 pt-0 w-full">
            <RiskGauge score={avgRisk} size={180} />
            <div className="flex gap-4 text-xs text-text-secondary">
              <span><span className="text-danger font-medium">{highRiskCount}</span> high-risk users</span>
              <span><span className="text-text-primary font-medium">{riskScores.length}</span> total employees</span>
            </div>
            <Link href="/admin/users" className="text-xs text-accent hover:underline">
              View user risk →
            </Link>
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Siren className="h-4 w-4 text-accent" />
              Recent Campaigns
            </CardTitle>
            <Link href="/admin/campaigns" className="text-xs text-accent hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {campaigns.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">No campaigns yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {c.template.type.replace("_", " ")} · {c._count.interactions} interactions ·{" "}
                        {new Date(c.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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

      {/* Audit Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-text-muted" />
            Recent Activity
          </CardTitle>
          <Link href="/admin/audit" className="text-xs text-accent hover:underline">
            Full audit log →
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border">
            {recentAudit.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-text-muted">
                    {log.entity} · {log.user?.name ?? "System"}
                  </p>
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap ml-4">
                  {new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {recentAudit.length === 0 && (
              <p className="text-sm text-text-muted py-3">No activity yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
