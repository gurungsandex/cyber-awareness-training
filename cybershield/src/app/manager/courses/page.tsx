import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Info } from "lucide-react";
import { AssignCourseButton } from "@/app/admin/courses/AssignCourseButton";

export default async function ManagerCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/");

  const managerId = session.user.id!;

  // For managers: only show courses explicitly granted by an admin.
  // For admins accessing this view: show all published courses.
  const [grantedCourseIds, departments] = await Promise.all([
    role === "ADMIN"
      ? null
      : db.managerGrant.findMany({ where: { managerId }, select: { courseId: true } }).then((g) => g.map((x) => x.courseId)),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const courses = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(grantedCourseIds !== null && { id: { in: grantedCourseIds } }),
    },
    include: {
      _count: { select: { modules: true, enrollments: true } },
      assessments: { select: { id: true } },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Assign Training</h1>
        <p className="text-text-secondary text-sm mt-1">
          {courses.length} course{courses.length !== 1 ? "s" : ""} available to assign to your team.
        </p>
      </div>

      {role === "MANAGER" && courses.length === 0 && (
        <div className="mb-5 rounded-card border border-border bg-elevated px-5 py-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            No courses have been enabled for you yet. Your administrator grants access to specific courses through the Manager Grants page.
          </p>
        </div>
      )}

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
                  {c._count.modules} module{c._count.modules !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {c.estimatedMin} min
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
            <p>No courses available to assign.</p>
          </div>
        )}
      </div>
    </div>
  );
}
