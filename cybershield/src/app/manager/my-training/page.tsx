import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle2, ChevronRight, AlertTriangle, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

function statusVariant(status: string): any {
  const m: Record<string, any> = {
    ENROLLED: "secondary", IN_PROGRESS: "default", COMPLETED: "success", FAILED: "destructive",
  };
  return m[status] ?? "secondary";
}

export default async function ManagerTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/");

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          assessments: { select: { id: true } },
          _count: { select: { modules: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-heading font-bold text-text-primary">My Training</h1>
        </div>
        <p className="text-text-secondary text-sm">
          {enrollments.length > 0
            ? `${enrollments.length} course${enrollments.length !== 1 ? "s" : ""} assigned to you.`
            : "No courses have been assigned to you yet."}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-card border border-border bg-elevated py-20 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-text-secondary font-medium">No training assigned</p>
          <p className="text-sm text-text-muted mt-1">Ask your admin to assign courses to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enrollments.map((e) => {
            const isOverdue = e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED";
            return (
              <Link
                key={e.id}
                href={`/employee/courses/${e.course.id}`}
                className="card flex flex-col hover:border-accent/30 transition-colors group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <BookOpen className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue && <AlertTriangle className="h-4 w-4 text-danger" />}
                      <Badge variant={statusVariant(e.status)} className="text-xs">
                        {e.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <h3 className="font-heading font-semibold text-text-primary text-sm leading-snug mb-1">
                    {e.course.title}
                  </h3>
                  <p className="text-xs text-text-muted line-clamp-2">{e.course.description}</p>
                </div>

                <div className="px-5 pb-5 mt-auto space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>Progress</span>
                      <span>{e.progressPct}%</span>
                    </div>
                    <div className="h-1 bg-border rounded-full">
                      <div
                        className={cn(
                          "h-1 rounded-full transition-all",
                          e.status === "COMPLETED" ? "bg-success" : "bg-accent"
                        )}
                        style={{ width: `${e.progressPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{e.course.estimatedMin} min
                    </span>
                    {e.dueAt && e.status !== "COMPLETED" && (
                      <span className={isOverdue ? "text-danger" : ""}>
                        Due {new Date(e.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    {e.status === "COMPLETED" && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                      {e.course._count.modules} modules · {e.course.assessments.length} quiz
                    </span>
                    <span className="text-xs text-accent group-hover:underline flex items-center gap-0.5">
                      {e.status === "COMPLETED" ? "Review" : e.status === "IN_PROGRESS" ? "Continue" : "Start"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
