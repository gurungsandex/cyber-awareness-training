import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, TrendingUp, ShieldAlert, AlertTriangle, Trophy,
  Users, BookOpen, Target, CheckCircle2, XCircle, Clock,
  FileDown, Building2
} from "lucide-react";
import { ExportReportButton } from "./ExportReportButton";

function riskLevel(score: number) {
  if (score >= 70) return { label: "High", color: "text-danger", bg: "bg-danger/10", border: "border-danger/20" };
  if (score >= 40) return { label: "Medium", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" };
  return { label: "Low", color: "text-success", bg: "bg-success/10", border: "border-success/20" };
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const tenantId = (session.user as any).tenantId ?? null;

  const [
    deptStats,
    interactionStats,
    enrollments,
    assessmentAttempts,
    allUsers,
    overdueCount,
    courses,
    recentCerts,
  ] = await Promise.all([
    db.department.findMany({
      where: { tenantId },
      include: {
        users: {
          where: { deletedAt: null },
          select: { riskScore: true, enrollments: { select: { status: true, dueAt: true } } },
        },
      },
    }),
    db.simulationInteraction.groupBy({ by: ["action"], where: { user: { tenantId } }, _count: { action: true } }),
    db.enrollment.findMany({ where: { user: { tenantId } }, select: { status: true, dueAt: true, completedAt: true } }),
    db.assessmentAttempt.findMany({ where: { user: { tenantId } }, select: { passed: true, scorePct: true } }),
    db.user.findMany({ where: { deletedAt: null, role: "EMPLOYEE", tenantId }, select: { riskScore: true } }),
    db.enrollment.count({ where: { user: { tenantId }, dueAt: { lt: new Date() }, status: { notIn: ["COMPLETED"] } } }),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true, title: true, isMandatory: true, complianceFrameworks: true,
        // Enrollment counts are scoped to this tenant's users so completion
        // rates don't include other tenants.
        _count: { select: { enrollments: { where: { user: { tenantId } } } } },
        enrollments: { where: { user: { tenantId } }, select: { status: true } },
      },
      orderBy: { isMandatory: "desc" },
    }),
    db.certificate.findMany({
      where: { user: { tenantId } },
      orderBy: { issuedAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
  ]);

  // ── Org-level metrics ──
  const totalEmployees = allUsers.length;
  const avgRisk = totalEmployees > 0
    ? Math.round(allUsers.reduce((s, u) => s + u.riskScore, 0) / totalEmployees)
    : 0;
  const highRisk = allUsers.filter((u) => u.riskScore >= 70).length;
  const medRisk = allUsers.filter((u) => u.riskScore >= 40 && u.riskScore < 70).length;
  const lowRisk = allUsers.filter((u) => u.riskScore < 40).length;

  const completedEnrollments = enrollments.filter((e) => e.status === "COMPLETED").length;
  const totalEnrollments = enrollments.length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
  const pendingCount = enrollments.filter((e) => e.status !== "COMPLETED").length;

  const passRate = assessmentAttempts.length > 0
    ? Math.round((assessmentAttempts.filter((a) => a.passed).length / assessmentAttempts.length) * 100)
    : 0;
  const failRate = 100 - passRate;
  const avgScore = assessmentAttempts.length > 0
    ? Math.round(assessmentAttempts.reduce((s, a) => s + a.scorePct, 0) / assessmentAttempts.length)
    : 0;

  const clickedCount = interactionStats.find((s) => s.action === "CLICKED_LINK")?._count.action ?? 0;
  const reportedCount = interactionStats.find((s) => s.action === "REPORTED")?._count.action ?? 0;
  const totalSims = interactionStats.reduce((s, i) => s + i._count.action, 0);
  const phishClickRate = totalSims > 0 ? Math.round((clickedCount / totalSims) * 100) : 0;

  // ── Risk score formula explanation ──
  // Risk = (failRate * 0.4) + (overdueRate * 0.35) + (pendingRate * 0.25)
  const overdueRate = totalEnrollments > 0 ? Math.round((overdueCount / totalEnrollments) * 100) : 0;
  const pendingRate = totalEnrollments > 0 ? Math.round((pendingCount / totalEnrollments) * 100) : 0;
  const computedRisk = Math.min(100, Math.round(failRate * 0.4 + overdueRate * 0.35 + pendingRate * 0.25));

  const reportData = {
    generatedAt: new Date().toISOString(),
    totalEmployees,
    avgRisk,
    completionRate,
    passRate,
    overdueCount,
    computedRisk,
    phishClickRate,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Reports & Analytics</h1>
          <p className="text-text-secondary text-sm mt-1">
            Executive summary · Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <ExportReportButton data={reportData} />
      </div>

      {/* ── Executive Summary Banner ── */}
      <div className={`rounded-card border p-5 ${riskLevel(computedRisk).bg} ${riskLevel(computedRisk).border}`}>
        <div className="flex items-start gap-4">
          <ShieldAlert className={`h-8 w-8 flex-shrink-0 mt-0.5 ${riskLevel(computedRisk).color}`} />
          <div>
            <h2 className="font-heading font-bold text-text-primary text-lg mb-1">
              Organisation Risk Level: <span className={riskLevel(computedRisk).color}>{riskLevel(computedRisk).label}</span>
              <span className={`ml-2 text-base ${riskLevel(computedRisk).color}`}>({computedRisk}/100)</span>
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Risk is calculated from assessment fail rate ({failRate}% weight 40%),
              overdue course rate ({overdueRate}% weight 35%),
              and pending course rate ({pendingRate}% weight 25%).
              {computedRisk >= 70 && " Immediate action required — high-risk areas need intervention."}
              {computedRisk >= 40 && computedRisk < 70 && " Moderate risk — focus on overdue completions and retesting failed employees."}
              {computedRisk < 40 && " Strong posture — maintain regular training cycles and monitor for emerging risks."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", note: `${completedEnrollments} of ${totalEnrollments}` },
          { label: "Avg Quiz Score", value: `${avgScore}%`, icon: Trophy, color: "text-accent", bg: "bg-accent/10", note: `${assessmentAttempts.length} attempts` },
          { label: "Overdue Courses", value: overdueCount, icon: Clock, color: "text-danger", bg: "bg-danger/10", note: "Need escalation" },
          { label: "Phish Click Rate", value: `${phishClickRate}%`, icon: Target, color: "text-warning", bg: "bg-warning/10", note: `${clickedCount} clicks detected` },
        ].map((m) => (
          <div key={m.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-2xl font-heading font-bold text-text-primary">{m.value}</p>
            <p className="text-xs font-medium text-text-secondary mt-0.5">{m.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{m.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Risk distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-accent" />
              Employee Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Low Risk", count: lowRisk, color: "bg-success", textColor: "text-success" },
              { label: "Medium Risk", count: medRisk, color: "bg-warning", textColor: "text-warning" },
              { label: "High Risk", count: highRisk, color: "bg-danger", textColor: "text-danger" },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-medium ${r.textColor}`}>{r.label}</span>
                  <span className="text-text-muted">{r.count} employees</span>
                </div>
                <div className="h-2 bg-border rounded-full">
                  <div
                    className={`h-2 ${r.color} rounded-full transition-all`}
                    style={{ width: totalEmployees > 0 ? `${(r.count / totalEmployees) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-text-muted">Org avg risk score: <span className={`font-semibold ${riskLevel(avgRisk).color}`}>{avgRisk}/100</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Course completion by course */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-accent" />
              Course Completion Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.map((c) => {
              const done = c.enrollments.filter((e) => e.status === "COMPLETED").length;
              const rate = c._count.enrollments > 0 ? Math.round((done / c._count.enrollments) * 100) : 0;
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2 min-w-0 mr-2">
                      <span className="text-xs font-medium text-text-primary truncate">{c.title}</span>
                      {c.isMandatory && <Badge variant="destructive" className="text-[10px] flex-shrink-0">Req</Badge>}
                    </div>
                    <span className="text-xs text-text-muted flex-shrink-0">{done}/{c._count.enrollments}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full">
                    <div
                      className={`h-1.5 rounded-full transition-all ${rate >= 80 ? "bg-success" : rate >= 50 ? "bg-warning" : "bg-danger"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">{rate}% complete</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Department breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-accent" />
              Department Risk Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deptStats.filter((d) => d.users.length > 0).map((dept) => {
                const totalDeptUsers = dept.users.length;
                const avgDeptRisk = Math.round(dept.users.reduce((s, u) => s + u.riskScore, 0) / totalDeptUsers);
                const allEnrollments = dept.users.flatMap((u) => u.enrollments);
                const completed = allEnrollments.filter((e) => e.status === "COMPLETED").length;
                const rate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;
                const overdue = allEnrollments.filter((e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED").length;
                const rl = riskLevel(avgDeptRisk);
                return (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-sm font-medium text-text-primary">{dept.name}</span>
                        <span className="text-xs text-text-muted ml-2">{totalDeptUsers} users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {overdue > 0 && (
                          <span className="text-xs text-danger flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />{overdue} overdue
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${rl.color}`}>Risk: {avgDeptRisk}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-border rounded-full">
                      <div
                        className={`h-1.5 rounded-full transition-all ${rate >= 80 ? "bg-success" : rate >= 50 ? "bg-warning" : "bg-danger"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{rate}% course completion</p>
                  </div>
                );
              })}
              {deptStats.every((d) => d.users.length === 0) && (
                <p className="text-sm text-text-muted py-4 text-center">No department data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Simulation stats + recent certs */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-accent" />
                Phishing Simulation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interactionStats.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">No simulation data yet. Launch a campaign to begin.</p>
              ) : (
                <div className="space-y-2">
                  {interactionStats.map((s) => {
                    const pct = totalSims > 0 ? Math.round((s._count.action / totalSims) * 100) : 0;
                    const isNegative = ["CLICKED_LINK", "SUBMITTED_CREDENTIALS"].includes(s.action);
                    return (
                      <div key={s.action} className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary w-32 capitalize flex-shrink-0">
                          {s.action.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <div className="flex-1 h-1.5 bg-border rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${isNegative ? "bg-danger" : "bg-success"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-text-primary w-8 text-right">{s._count.action}</span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-text-muted pt-2 border-t border-border">
                    Total interactions: {totalSims} · Reported rate: {totalSims > 0 ? Math.round((reportedCount / totalSims) * 100) : 0}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-accent" />
                Recent Certificates Issued
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCerts.length === 0 ? (
                <p className="text-sm text-text-muted py-2 text-center">No certificates issued yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentCerts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.user.name}</p>
                        <p className="text-xs text-text-muted truncate max-w-48">{c.courseTitle}</p>
                      </div>
                      <span className="text-xs text-text-muted flex-shrink-0 ml-2">
                        {new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
