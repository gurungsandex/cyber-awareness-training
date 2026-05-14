import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Users, FileQuestion, Layers, CheckCircle2 } from "lucide-react";
import { AssignCourseButton } from "./AssignCourseButton";

export default async function AdminCoursesPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const [courses, departments] = await Promise.all([
    db.course.findMany({
      orderBy: [{ isMandatory: "desc" }, { title: "asc" }],
      include: {
        _count: { select: { enrollments: true } },
        modules: { include: { _count: { select: { lessons: true } } } },
        assessments: { include: { _count: { select: { questions: true } } } },
      },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalUsers = await db.user.count({ where: { deletedAt: null } });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Courses</h1>
        <p className="text-text-secondary text-sm mt-1">
          {courses.length} courses in the platform. Assign them to employees or departments.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {courses.map((course) => {
          const totalLessons = course.modules.reduce((s, m) => s + m._count.lessons, 0);
          const totalQuestions = course.assessments.reduce((s, a) => s + a._count.questions, 0);
          const enrollmentRate = totalUsers > 0
            ? Math.round((course._count.enrollments / totalUsers) * 100)
            : 0;

          return (
            <Card key={course.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <BookOpen className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant={course.status === "PUBLISHED" ? "success" : "secondary"}>
                        {course.status}
                      </Badge>
                      {course.isMandatory && <Badge variant="destructive">Mandatory</Badge>}
                    </div>
                  </div>
                  <AssignCourseButton
                    courseId={course.id}
                    courseTitle={course.title}
                    departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  />
                </div>
                <CardTitle className="text-sm">{course.title}</CardTitle>
                <p className="text-xs text-text-muted line-clamp-2 mt-1">{course.description}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Modules", value: course.modules.length, Icon: Layers, color: "text-accent" },
                    { label: "Lessons", value: totalLessons, Icon: BookOpen, color: "text-success" },
                    { label: "Questions", value: totalQuestions, Icon: FileQuestion, color: "text-warning" },
                    { label: "Enrolled", value: course._count.enrollments, Icon: Users, color: "text-text-secondary" },
                  ].map((s) => (
                    <div key={s.label} className="bg-elevated rounded-lg p-2">
                      <p className="text-xs text-text-muted">{s.label}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <s.Icon className={`h-3 w-3 ${s.color}`} />
                        <p className="font-semibold text-text-primary text-sm">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span>Enrollment coverage</span>
                    <span>{enrollmentRate}%</span>
                  </div>
                  <div className="h-1 bg-border rounded-full">
                    <div
                      className="h-1 bg-accent rounded-full transition-all"
                      style={{ width: `${enrollmentRate}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{course.estimatedMin} min
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />Pass: {course.passMark}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && (
          <div className="col-span-2 py-16 text-center text-text-muted">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No courses yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
