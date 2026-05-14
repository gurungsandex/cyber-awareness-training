import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/RiskGauge";
import { BookOpen, Shield, Bell, CheckCircle2, Clock, AlertTriangle, Inbox, Trophy } from "lucide-react";

function statusBadge(status: string): any {
  const m: Record<string, any> = {
    ENROLLED: "secondary", IN_PROGRESS: "default", COMPLETED: "success", FAILED: "destructive",
  };
  return m[status] ?? "secondary";
}

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id!;

  const [enrollments, unreadNotifs, tip, user, certCount, inboxUnread] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: { course: { select: { title: true, estimatedMin: true } } },
      orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
      take: 6,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.securityTip.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }),
    db.user.findUnique({ where: { id: userId }, select: { riskScore: true, name: true } }),
    db.certificate.count({ where: { userId } }),
    db.simulatedInboxItem.count({ where: { userId, isRead: false } }),
  ]);

  const completedCount = enrollments.filter((e) => e.status === "COMPLETED").length;
  const overdueCount = enrollments.filter(
    (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
  ).length;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const quickStats = [
    { label: "Overdue", value: overdueCount, icon: AlertTriangle, color: "text-danger", bg: "bg-danger/10", href: "/employee/courses" },
    { label: "Completed", value: completedCount, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", href: "/employee/certificates" },
    { label: "Certificates", value: certCount, icon: Trophy, color: "text-warning", bg: "bg-warning/10", href: "/employee/certificates" },
    { label: "Notifications", value: unreadNotifs, icon: Bell, color: "text-accent", bg: "bg-accent/10", href: "/employee/notifications" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Motivational Banner */}
      <div className="rounded-card border border-accent/20 bg-gradient-to-r from-accent/10 to-transparent p-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {overdueCount > 0
              ? `You have ${overdueCount} overdue training${overdueCount > 1 ? "s" : ""}. Let's get caught up!`
              : "You're on track with your security training. Keep it up!"}
          </p>
        </div>
        <Shield className="h-12 w-12 text-accent/30 hidden sm:block" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="card p-4 flex items-center gap-3 hover:border-accent/30 transition-colors cursor-pointer">
              <div className={`p-2.5 rounded-lg ${s.bg} flex-shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-heading font-bold text-text-primary">{s.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* My Courses */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-accent" />
              My Training
            </CardTitle>
            <Link href="/employee/courses" className="text-xs text-accent hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {enrollments.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">No courses assigned yet.</p>
            ) : (
              enrollments.map((e) => {
                const isOverdue = e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED";
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-elevated p-3 hover:border-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-text-primary truncate">{e.course.title}</p>
                        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-danger flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-border rounded-full max-w-36">
                          <div
                            className="h-1 bg-accent rounded-full transition-all"
                            style={{ width: `${e.progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{e.progressPct}%</span>
                        <span className="text-xs text-text-muted">· {e.course.estimatedMin}m</span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                      {e.dueAt && e.status !== "COMPLETED" && (
                        <span className={`text-xs ${isOverdue ? "text-danger" : "text-text-muted"}`}>
                          Due {new Date(e.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      <Badge variant={statusBadge(e.status)} className="text-xs">
                        {e.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Risk Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-accent" />
                My Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <RiskGauge score={user?.riskScore ?? 0} size={160} />
            </CardContent>
          </Card>

          {/* Sim Inbox Teaser */}
          <Link href="/employee/inbox">
            <div className="card p-4 flex items-center gap-3 hover:border-accent/30 transition-colors cursor-pointer">
              <div className="p-2.5 rounded-lg bg-warning/10 flex-shrink-0">
                <Inbox className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Phishing Sim Inbox</p>
                <p className="text-xs text-text-muted">
                  {inboxUnread > 0 ? `${inboxUnread} new simulated email${inboxUnread > 1 ? "s" : ""}` : "No new simulations"}
                </p>
              </div>
            </div>
          </Link>

          {/* Security Tip */}
          {tip && (
            <div className="card border-accent/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-accent uppercase tracking-wide">Security Tip</span>
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">{tip.title}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{tip.body}</p>
              <span className="mt-2 inline-block text-xs text-text-muted bg-elevated px-2 py-0.5 rounded-full capitalize border border-border">
                {tip.category}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
