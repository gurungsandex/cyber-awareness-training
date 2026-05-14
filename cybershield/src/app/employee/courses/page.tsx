import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle2 } from "lucide-react";

function statusVariant(status: string): "secondary" | "default" | "success" | "destructive" {
  const map: Record<string, "secondary" | "default" | "success" | "destructive"> = {
    ENROLLED: "secondary", IN_PROGRESS: "default", COMPLETED: "success", FAILED: "destructive",
  };
  return map[status] ?? "secondary";
}

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    include: { course: { include: { assessments: true } } },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
        <p className="text-gray-500 mt-1">{enrollments.length} course(s) assigned to you.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {enrollments.map((e) => (
          <Card key={e.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="p-2 rounded-lg bg-brand-50">
                  <BookOpen className="h-5 w-5 text-brand-600" />
                </div>
                <Badge variant={statusVariant(e.status)}>{e.status.replace("_", " ")}</Badge>
              </div>
              <CardTitle className="mt-3 text-base">{e.course.title}</CardTitle>
              <p className="text-sm text-gray-500 line-clamp-2">{e.course.description}</p>
            </CardHeader>
            <CardContent className="mt-auto">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Progress</span>
                  <span>{e.progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-brand-500 rounded-full transition-all" style={{ width: `${e.progressPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {e.course.estimatedMin} min
                  </span>
                  {e.dueAt && (
                    <span className={new Date(e.dueAt) < new Date() && e.status !== "COMPLETED" ? "text-red-500" : ""}>
                      Due {new Date(e.dueAt).toLocaleDateString()}
                    </span>
                  )}
                  {e.status === "COMPLETED" && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> Completed
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {enrollments.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No courses assigned yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
