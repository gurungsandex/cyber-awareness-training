import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Users, FileQuestion, Layers, CheckCircle2, RefreshCw, ShieldCheck, Eye } from "lucide-react";
import { AssignCourseButton } from "./AssignCourseButton";
import Link from "next/link";

const FRAMEWORK_COLORS: Record<string, string> = {
  GDPR: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  HIPAA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  PCI_DSS: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  SOC2: "bg-green-500/10 text-green-400 border-green-500/20",
  NIST_CSF: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ISO_27001: "bg-red-500/10 text-red-400 border-red-500/20",
  CIS_CONTROLS: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  GENERAL: "bg-text-muted/10 text-text-muted border-border",
};

function frameworkLabel(f: string): string {
  const m: Record<string, string> = {
    PCI_DSS: "PCI DSS", NIST_CSF: "NIST CSF", ISO_27001: "ISO 27001",
    CIS_CONTROLS: "CIS Controls", GDPR: "GDPR", HIPAA: "HIPAA",
    SOC2: "SOC 2", GENERAL: "General",
  };
  return m[f] ?? f;
}

export default async function AdminCoursesPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");
  const tenantId = (session.user as any).tenantId ?? null;
  const tenantFilter = tenantId ? { tenantId } : {};

  const [courses, departments] = await Promise.all([
    db.course.findMany({
      where: tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {},
      orderBy: [{ isMandatory: "desc" }, { title: "asc" }],
      include: {
        _count: { select: { enrollments: true } },
        modules: { include: { _count: { select: { lessons: true } } } },
        assessments: { include: { _count: { select: { questions: true } } } },
      },
    }),
    db.department.findMany({ where: tenantFilter, orderBy: { name: "asc" } }),
  ]);

  const totalUsers = await db.user.count({ where: { deletedAt: null, ...tenantFilter } });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Courses</h1>
          <p className="text-text-secondary text-sm mt-1">
            {courses.length} courses · Assign to employees, departments, or groups.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/templates" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
            Manage simulation templates →
          </Link>
        </div>
      </div>

      {/* Compliance filter hint */}
      <div className="mb-5 rounded-card border border-border bg-elevated px-5 py-3.5 flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-accent flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          Each course is tagged with the compliance frameworks it helps satisfy.
          Use the <strong className="text-text-primary">Assign</strong> button to enrol users — by department, role, or all employees.
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
                      {course.isRecurring && (
                        <Badge variant="outline" className="gap-1">
                          <RefreshCw className="h-2.5 w-2.5" />
                          Recurring
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/employee/courses/${course.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Link>
                    <AssignCourseButton
                      courseId={course.id}
                      courseTitle={course.title}
                      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                    />
                  </div>
                </div>
                <CardTitle className="text-sm">{course.title}</CardTitle>
                <p className="text-xs text-text-muted line-clamp-2 mt-1">{course.description}</p>

                {/* Compliance framework tags */}
                {course.complianceFrameworks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {course.complianceFrameworks.map((f) => (
                      <span
                        key={f}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${FRAMEWORK_COLORS[f] ?? FRAMEWORK_COLORS.GENERAL}`}
                      >
                        {frameworkLabel(f)}
                      </span>
                    ))}
                  </div>
                )}
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
                    <div className="h-1 bg-accent rounded-full transition-all" style={{ width: `${enrollmentRate}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{course.estimatedMin} min
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />Pass: {course.passMark}%
                  </span>
                  {course.isRecurring && course.recurringIntervalMonths && (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />Every {course.recurringIntervalMonths}mo
                    </span>
                  )}
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
