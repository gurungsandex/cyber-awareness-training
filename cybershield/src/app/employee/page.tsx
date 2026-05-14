import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Shield, Bell, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

function riskColor(score: number) {
  if (score >= 70) return "destructive";
  if (score >= 40) return "warning";
  return "success";
}

function statusBadge(status: string) {
  const map: Record<string, "secondary" | "default" | "success" | "destructive"> = {
    ENROLLED: "secondary",
    IN_PROGRESS: "default",
    COMPLETED: "success",
    FAILED: "destructive",
  };
  return map[status] ?? "secondary";
}

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [enrollments, unreadNotifs, tip, user] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { assignedAt: "desc" },
      take: 5,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.securityTip.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }),
    db.user.findUnique({ where: { id: userId }, select: { riskScore: true, name: true } }),
  ]);

  const completedCount = enrollments.filter((e) => e.status === "COMPLETED").length;
  const dueCount = enrollments.filter(
    (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
  ).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your security training overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-50">
                <Shield className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Risk Score</p>
                <p className="text-2xl font-bold text-gray-900">{user?.riskScore ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{dueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Notifications</p>
                <p className="text-2xl font-bold text-gray-900">{unreadNotifs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-600" />
                My Courses
              </CardTitle>
              <Link href="/employee/courses" className="text-sm text-brand-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No courses assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 truncate">{e.course.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-32">
                            <div
                              className="h-1.5 bg-brand-500 rounded-full"
                              style={{ width: `${e.progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{e.progressPct}%</span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <Badge variant={statusBadge(e.status)}>
                          {e.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Security Tip */}
        <div>
          {tip && (
            <Card className="border-brand-200 bg-brand-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-brand-800">
                  <AlertTriangle className="h-5 w-5 text-brand-600" />
                  Security Tip
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-brand-900 mb-2">{tip.title}</p>
                <p className="text-sm text-brand-700">{tip.body}</p>
                <span className="mt-3 inline-block text-xs text-brand-500 bg-brand-100 px-2 py-0.5 rounded-full capitalize">
                  {tip.category}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
