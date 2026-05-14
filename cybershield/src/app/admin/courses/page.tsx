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
        modules: {
          include: {
            _count: { select: { lessons: true } },
          },
        },
        assessments: {
          include: { _count: { select: { questions: true } } },
        },
      },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalUsers = await db.user.count({ where: { deletedAt: null } });

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-500 mt-1">
            {courses.length} courses in the platform. Assign them to employees or departments below.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
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
                    <div className="p-2 rounded-lg bg-brand-50">
                      <BookOpen className="h-5 w-5 text-brand-600" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant={course.status === "PUBLISHED" ? "success" : "secondary"}>
                        {course.status}
                      </Badge>
                      {course.isMandatory && (
                        <Badge variant="destructive">Mandatory</Badge>
                      )}
                    </div>
                  </div>
                  <AssignCourseButton
                    courseId={course.id}
                    courseTitle={course.title}
                    departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  />
                </div>
                <CardTitle className="text-base">{course.title}</CardTitle>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1">{course.description}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Modules</p>
                    <div className="flex items-center justify-center gap-1">
                      <Layers className="h-3 w-3 text-brand-500" />
                      <p className="font-semibold text-gray-800">{course.modules.length}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Lessons</p>
                    <div className="flex items-center justify-center gap-1">
                      <BookOpen className="h-3 w-3 text-blue-500" />
                      <p className="font-semibold text-gray-800">{totalLessons}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Questions</p>
                    <div className="flex items-center justify-center gap-1">
                      <FileQuestion className="h-3 w-3 text-purple-500" />
                      <p className="font-semibold text-gray-800">{totalQuestions}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Enrolled</p>
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-green-500" />
                      <p className="font-semibold text-gray-800">{course._count.enrollments}</p>
                    </div>
                  </div>
                </div>

                {/* Enrollment bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Enrollment coverage</span>
                    <span>{enrollmentRate}% of users</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-1.5 bg-brand-500 rounded-full transition-all"
                      style={{ width: `${enrollmentRate}%` }}
                    />
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
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
      </div>
    </div>
  );
}
