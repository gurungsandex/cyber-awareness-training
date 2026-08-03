import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { NudgeButton } from "./NudgeButton";

function riskClass(score: number) {
  if (score >= 70) return "text-danger";
  if (score >= 40) return "text-warning";
  return "text-success";
}

export default async function ManagerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const senderId = session.user.id!;
  const tenantId = (session.user as any).tenantId ?? null;

  const users = await db.user.findMany({
    where: { deletedAt: null, role: "EMPLOYEE", tenantId },
    include: {
      department: { select: { name: true } },
      enrollments: {
        select: { id: true, status: true, dueAt: true, courseId: true, course: { select: { title: true } } },
      },
    },
    orderBy: { riskScore: "desc" },
  });

  const allEnrollments = users.flatMap((u) => u.enrollments);
  const completed      = allEnrollments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = allEnrollments.length > 0 ? Math.round((completed / allEnrollments.length) * 100) : 0;
  const atRisk         = users.filter((u) => u.riskScore >= 60).length;
  const overdue        = users.filter((u) =>
    u.enrollments.some((e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED")
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">Team Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Security awareness posture across your team.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Team Members", value: users.length,       icon: Users,          color: "text-accent",   bg: "bg-accent/10" },
          { label: "Completion Rate", value: `${completionRate}%`, icon: TrendingUp,  color: "text-success",  bg: "bg-success/10" },
          { label: "Need Attention", value: atRisk,           icon: AlertTriangle,   color: "text-danger",   bg: "bg-danger/10" },
        ].map((s) => (
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

      {/* Overdue banner */}
      {overdue > 0 && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-5 py-3.5 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">
            <strong>{overdue}</strong> team member{overdue > 1 ? "s have" : " has"} overdue training. Use the nudge button to send a reminder.
          </p>
        </div>
      )}

      {/* Team table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold text-text-primary">
              Team Members
              <span className="ml-2 font-normal text-text-muted">{users.length} people</span>
            </h2>
          </div>
          <Link href="/manager/team" className="text-xs text-accent hover:underline flex items-center gap-0.5">
            Full table <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                {["Name", "Department", "Risk", "Training Progress", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.slice(0, 10).map((u) => {
                const total   = u.enrollments.length;
                const done    = u.enrollments.filter((e) => e.status === "COMPLETED").length;
                const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
                const overdueEnrollment = u.enrollments.find(
                  (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
                );
                const isOverdue = !!overdueEnrollment;

                return (
                  <tr key={u.id} className="hover:bg-elevated/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                      {u.department?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`font-bold text-sm ${riskClass(u.riskScore)}`}>{u.riskScore}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-border rounded-full min-w-[80px]">
                          <div className="h-1.5 bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
                          {done}/{total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : u.riskScore >= 70 ? (
                        <Badge variant="warning">High Risk</Badge>
                      ) : (
                        <Badge variant="success">On Track</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <NudgeButton
                        senderId={senderId}
                        targetUserId={u.id}
                        targetName={u.name}
                        enrollmentId={overdueEnrollment?.id}
                      />
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-muted text-sm">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {users.length > 10 && (
          <div className="px-5 py-3 border-t border-border bg-elevated/30">
            <Link href="/manager/team" className="text-xs text-accent hover:underline">
              View all {users.length} team members →
            </Link>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/manager/courses"
          className="card p-5 hover:border-accent/30 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              Assign Training
            </p>
            <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors" />
          </div>
          <p className="text-xs text-text-muted">Select a course and assign it to one or more team members.</p>
        </Link>
        <Link
          href="/manager/reports"
          className="card p-5 hover:border-accent/30 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              View Reports
            </p>
            <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors" />
          </div>
          <p className="text-xs text-text-muted">Department completion rates and risk score breakdown.</p>
        </Link>
      </div>
    </div>
  );
}
