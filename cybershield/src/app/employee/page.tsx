import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/RiskGauge";
import { BookOpen, Shield, Bell, CheckCircle2, AlertTriangle, Inbox, Trophy, Clock, ChevronRight, ArrowRight, Mail } from "lucide-react";
import { MicroAssessmentBanner } from "./micro-assessment/MicroAssessmentBanner";
import { cn } from "@/lib/utils";

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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [enrollments, unreadNotifs, tip, user, certCount, inboxUnread, retentionCheck] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, estimatedMin: true, description: true } } },
      orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.securityTip.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }),
    db.user.findUnique({ where: { id: userId }, select: { riskScore: true, name: true } }),
    db.certificate.count({ where: { userId } }),
    db.simulatedInboxItem.count({ where: { userId, isRead: false } }),
    db.enrollment.findFirst({
      where: {
        userId,
        status: "COMPLETED",
        completedAt: { lte: sevenDaysAgo },
        course: { retentionCheckEnabled: true },
      },
      include: {
        course: {
          select: { title: true, assessments: { include: { questions: { take: 3, orderBy: { orderIndex: "asc" } } } } },
        },
      },
      orderBy: { completedAt: "asc" },
    }),
  ]);

  const completedEnrollments  = enrollments.filter((e) => e.status === "COMPLETED");
  const inProgressEnrollments = enrollments.filter((e) => e.status === "IN_PROGRESS");
  const assignedEnrollments   = enrollments.filter((e) => e.status !== "COMPLETED");
  const overdueCount          = enrollments.filter(
    (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
  ).length;

  // The "continue" card is the first in-progress course, or the first assigned one
  const continueEnrollment = inProgressEnrollments[0] ?? (assignedEnrollments.length > 0 && assignedEnrollments[0].status === "ENROLLED" ? assignedEnrollments[0] : null);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const retentionQuestions = retentionCheck?.course.assessments[0]?.questions.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options as { id: string; text: string }[],
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
  })) ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 space-y-7 max-w-5xl">
      {/* Greeting */}
      <div>
        <p className="text-sm text-text-muted mb-0.5">{greeting}</p>
        <h1 className="text-2xl font-heading font-bold text-text-primary">{firstName}</h1>
        {overdueCount > 0 ? (
          <p className="text-sm text-danger mt-1 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} overdue training{overdueCount > 1 ? "s" : ""} — please complete as soon as possible.
          </p>
        ) : (
          <p className="text-sm text-text-secondary mt-1">You are on track with your security training.</p>
        )}
      </div>

      {/* Retention micro-assessment */}
      {retentionCheck && retentionQuestions.length > 0 && (
        <MicroAssessmentBanner
          courseTitle={retentionCheck.course.title}
          enrollmentId={retentionCheck.id}
          questions={retentionQuestions}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Continue where you left off */}
          {continueEnrollment && (
            <section>
              <h2 className="text-sm font-heading font-semibold text-text-primary mb-3">Continue where you left off</h2>
              <Link
                href={`/employee/courses/${continueEnrollment.course.id}`}
                className="card flex flex-col sm:flex-row sm:items-center gap-5 p-5 hover:border-accent/30 transition-colors group"
              >
                <div className="p-3 rounded-xl bg-accent/10 flex-shrink-0 self-start sm:self-center">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-heading font-semibold text-text-primary text-sm leading-snug">
                      {continueEnrollment.course.title}
                    </h3>
                    <Badge variant={statusBadge(continueEnrollment.status)} className="text-xs">
                      {continueEnrollment.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 mb-3">{continueEnrollment.course.description}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-48">
                      <div className="flex justify-between text-xs text-text-muted mb-1">
                        <span>Progress</span>
                        <span>{continueEnrollment.progressPct}%</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full">
                        <div
                          className="h-1.5 bg-accent rounded-full transition-all"
                          style={{ width: `${continueEnrollment.progressPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />{continueEnrollment.course.estimatedMin} min
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 self-center">
                  <span className="text-sm font-medium text-accent flex items-center gap-1 group-hover:gap-2 transition-all">
                    {continueEnrollment.status === "IN_PROGRESS" ? "Continue" : "Start"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </section>
          )}

          {/* Assigned to you */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-heading font-semibold text-text-primary">
                Assigned to you
                {assignedEnrollments.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    {completedEnrollments.length} of {enrollments.length} complete
                  </span>
                )}
              </h2>
              <Link href="/employee/courses" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {enrollments.length === 0 ? (
              <div className="card p-8 text-center text-text-muted">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No courses assigned yet.</p>
                <p className="text-xs text-text-muted mt-1">Your manager or administrator will assign training to you.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enrollments.slice(0, 6).map((e) => {
                  const isOverdue = e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED";
                  return (
                    <Link
                      key={e.id}
                      href={`/employee/courses/${e.course.id}`}
                      className={cn(
                        "card p-4 flex flex-col gap-3 hover:border-accent/30 transition-colors group",
                        isOverdue && "border-danger/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-text-primary leading-snug group-hover:text-accent transition-colors">
                          {e.course.title}
                        </p>
                        {isOverdue
                          ? <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
                          : e.status === "COMPLETED"
                          ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                          : null
                        }
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-text-muted mb-1">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.course.estimatedMin} min</span>
                          {e.dueAt && e.status !== "COMPLETED" && (
                            <span className={isOverdue ? "text-danger" : ""}>
                              Due {new Date(e.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <div className="h-1 bg-border rounded-full">
                          <div
                            className={cn("h-1 rounded-full transition-all", e.status === "COMPLETED" ? "bg-success" : "bg-accent")}
                            style={{ width: `${e.progressPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={statusBadge(e.status)} className="text-xs">
                          {e.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-accent">
                          {e.status === "COMPLETED" ? "Review" : e.status === "IN_PROGRESS" ? "Continue" : "Start"}
                          <ChevronRight className="h-3 w-3 inline ml-0.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column — status panel */}
        <div className="space-y-5">
          {/* Risk score */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-accent" />
              <p className="text-sm font-heading font-semibold text-text-primary">My Risk Score</p>
            </div>
            <RiskGauge score={user?.riskScore ?? 0} size={150} />
          </div>

          {/* Quick links */}
          <div className="card divide-y divide-border overflow-hidden">
            <Link href="/employee/inbox" className="flex items-center justify-between px-4 py-3 hover:bg-elevated transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Inbox className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Phishing Inbox</p>
                  <p className="text-xs text-text-muted">
                    {inboxUnread > 0 ? `${inboxUnread} new simulation${inboxUnread > 1 ? "s" : ""}` : "No new simulations"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </Link>
            <Link href="/employee/certificates" className="flex items-center justify-between px-4 py-3 hover:bg-elevated transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Trophy className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Certificates</p>
                  <p className="text-xs text-text-muted">{certCount} earned</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </Link>
            <Link href="/employee/notifications" className="flex items-center justify-between px-4 py-3 hover:bg-elevated transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Bell className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Notifications</p>
                  <p className="text-xs text-text-muted">
                    {unreadNotifs > 0 ? `${unreadNotifs} unread` : "All read"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </Link>
          </div>

          {/* Security tip */}
          {tip && (
            <div className="card border-accent/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs font-medium text-accent uppercase tracking-wide">Security Tip</span>
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">{tip.title}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{tip.body}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
