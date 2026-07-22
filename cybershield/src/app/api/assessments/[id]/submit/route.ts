import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, requireAuth, handleZodError, audit } from "@/lib/api";
import { submitAssessmentSchema } from "@/lib/validations";
import { certificateQueue, remediationQueue } from "@/lib/queues";
import { adjustRiskScore, RISK_DELTAS } from "@/lib/risk";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;
  try {
    const body = submitAssessmentSchema.parse(await req.json());
    const assessment = await db.assessment.findUnique({
      where: { id: params.id }, include: { questions: true, course: true },
    });
    if (!assessment) return bad("Assessment not found", 404);

    // Score server-side
    let correctCount = 0;
    const detailed = body.answers.map(a => {
      const q = assessment.questions.find(qq => qq.id === a.questionId);
      const correct = !!q && q.correctOptionId === a.selectedOptionId;
      if (correct) correctCount++;
      return { questionId: a.questionId, selectedOptionId: a.selectedOptionId, correct, correctOptionId: q?.correctOptionId, explanation: q?.explanation };
    });

    const scorePct = Math.round((correctCount / Math.max(1, assessment.questions.length)) * 100);
    const passed = scorePct >= assessment.passMark;

    const attempt = await db.assessmentAttempt.create({
      data: {
        assessmentId: assessment.id, userId: ctx.user.id,
        scorePct, passed, answers: detailed as any,
      },
    });

    if (passed) {
      // Mark enrollment complete
      await db.enrollment.updateMany({
        where: { userId: ctx.user.id, courseId: assessment.courseId },
        data: { status: "COMPLETED", progressPct: 100, completedAt: new Date() },
      });
      await certificateQueue.add("issue", { attemptId: attempt.id }).catch(() => {});
      await adjustRiskScore(ctx.user.id, RISK_DELTAS.PASSED_ASSESSMENT);
    } else {
      // Trigger remediation
      await remediationQueue.add("enroll", { userId: ctx.user.id, trigger: "FAILED_ASSESSMENT" }).catch(() => {});
      await adjustRiskScore(ctx.user.id, RISK_DELTAS.FAILED_ASSESSMENT);
    }

    await audit(ctx.user.id, "ASSESSMENT_SUBMIT", "Assessment", assessment.id, { scorePct, passed });
    return ok({ attemptId: attempt.id, scorePct, passed, passMark: assessment.passMark, detailed });
  } catch (e) { return handleZodError(e); }
}
