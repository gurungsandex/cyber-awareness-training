import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { SimulationEngine } from "./SimulationEngine";

export default async function CoursePage({ params }: { params: { courseId: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id!;
  const role = (session.user as any).role as string;
  const isAdmin = role === "ADMIN";

  const [enrollment, course] = await Promise.all([
    db.enrollment.findFirst({
      where: { userId, courseId: params.courseId },
      select: { id: true, status: true, progressPct: true, simulationProgress: true },
    }),
    db.course.findUnique({
      where: { id: params.courseId },
      include: {
        modules: {
          orderBy: { orderIndex: "asc" },
          include: {
            lessons: {
              orderBy: { orderIndex: "asc" },
              select: { id: true, title: true, content: true, durationMin: true },
            },
          },
        },
        assessments: {
          take: 1,
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              select: { id: true, text: true, options: true, explanation: true, correctOptionId: true },
            },
          },
        },
      },
    }),
  ]);

  if (!course) notFound();

  // Admin can preview any course without an enrollment
  if (!enrollment && !isAdmin) redirect("/employee/courses");

  const previewEnrollment = { id: "preview", status: "ENROLLED", progressPct: 0, simulationProgress: null };
  const effectiveEnrollment = enrollment ?? previewEnrollment;
  const assessment = course.assessments[0] ?? null;

  return (
    <div className="min-h-full bg-canvas">
      <SimulationEngine
        courseId={params.courseId}
        courseTitle={course.title}
        courseDescription={course.description}
        modules={course.modules as any}
        assessment={assessment as any}
        enrollment={effectiveEnrollment as any}
        simulationSchema={course.simulationSchema as any}
        isPreview={isAdmin && !enrollment}
      />
    </div>
  );
}
