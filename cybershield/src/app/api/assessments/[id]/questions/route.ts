import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, requireAuth, requireRole, handleZodError, audit } from "@/lib/api";

// GET = shuffled questions for the employee (without correct answer)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;

  const assessment = await db.assessment.findUnique({
    where: { id: params.id }, include: { questions: true },
  });
  if (!assessment) return bad("Not found", 404);

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: ctx.user.id, courseId: assessment.courseId } },
  });
  if (!enrollment) return bad("Not enrolled in this course", 403);

  const shuffled = [...assessment.questions].sort(() => Math.random() - 0.5);
  const masked = shuffled.map(q => ({
    id: q.id, text: q.text,
    options: (q.options as any[]).slice().sort(() => Math.random() - 0.5),
  }));

  return ok({ id: assessment.id, title: assessment.title, passMark: assessment.passMark, questions: masked });
}

// POST = admin adds questions (manual or AI-generated bundle)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  try {
    const body = await req.json() as { questions: Array<{ text: string; options: any[]; correctOptionId: string; explanation: string }>; aiGenerated?: boolean };

    const existingCount = await db.assessmentQuestion.count({ where: { assessmentId: params.id } });

    await db.assessmentQuestion.createMany({
      data: body.questions.map((q, i) => ({
        assessmentId: params.id, text: q.text, options: q.options as any,
        correctOptionId: q.correctOptionId, explanation: q.explanation,
        orderIndex: existingCount + i, aiGenerated: !!body.aiGenerated,
      })),
    });

    await audit(ctx.user.id, "ASSESSMENT_QUESTIONS_ADD", "Assessment", params.id, { count: body.questions.length });
    return ok({ added: body.questions.length });
  } catch (e) { return handleZodError(e); }
}
