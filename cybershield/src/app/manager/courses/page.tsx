import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock } from "lucide-react";
import { AssignCourseButton } from "@/app/admin/courses/AssignCourseButton";

export default async function ManagerCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/");

  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    include: {
      _count: { select: { modules: true, enrollments: true } },
      assessments: { select: { id: true } },
    },
    orderBy: { title: "asc" },
  });

  const departments = await db.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Assign Courses</h1>
        <p className="text-text-secondary text-sm mt-1">Assign training to your team members.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm leading-snug">{c.title}</CardTitle>
                {c.isMandatory && <Badge variant="destructive" className="flex-shrink-0 text-xs">Mandatory</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-text-muted line-clamp-2">{c.description}</p>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {c._count.modules} modules
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {c.estimatedMin}m
                </span>
              </div>
              <div className="mt-auto pt-2">
                <AssignCourseButton courseId={c.id} courseTitle={c.title} departments={departments} />
              </div>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && (
          <div className="col-span-3 py-16 text-center text-text-muted">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No published courses yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
