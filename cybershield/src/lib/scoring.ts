type Question = { id: string; correctOptionId: string; explanation: string | null };
type Answer = { questionId: string; selectedOptionId: string };

export function scoreAssessment(questions: Question[], answers: Answer[], passMark: number) {
  let correctCount = 0;
  const detailed = answers.map((a) => {
    const q = questions.find((qq) => qq.id === a.questionId);
    const correct = !!q && q.correctOptionId === a.selectedOptionId;
    if (correct) correctCount++;
    return {
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      correct,
      correctOptionId: q?.correctOptionId,
      explanation: q?.explanation,
    };
  });

  const scorePct = Math.round((correctCount / Math.max(1, questions.length)) * 100);
  const passed = scorePct >= passMark;

  return { scorePct, passed, detailed };
}
