import { describe, it, expect } from "vitest";
import { scoreAssessment } from "./scoring";

const questions = [
  { id: "q1", correctOptionId: "a", explanation: "because a" },
  { id: "q2", correctOptionId: "b", explanation: "because b" },
  { id: "q3", correctOptionId: "c", explanation: null },
];

describe("scoreAssessment", () => {
  it("scores all-correct answers as 100% and passed", () => {
    const result = scoreAssessment(
      questions,
      [
        { questionId: "q1", selectedOptionId: "a" },
        { questionId: "q2", selectedOptionId: "b" },
        { questionId: "q3", selectedOptionId: "c" },
      ],
      80
    );
    expect(result.scorePct).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.detailed.every((d) => d.correct)).toBe(true);
  });

  it("computes partial score and fails below pass mark", () => {
    const result = scoreAssessment(
      questions,
      [
        { questionId: "q1", selectedOptionId: "a" },
        { questionId: "q2", selectedOptionId: "wrong" },
        { questionId: "q3", selectedOptionId: "wrong" },
      ],
      80
    );
    expect(result.scorePct).toBe(33);
    expect(result.passed).toBe(false);
  });

  it("passes exactly at the pass mark boundary", () => {
    const result = scoreAssessment(
      questions,
      [
        { questionId: "q1", selectedOptionId: "a" },
        { questionId: "q2", selectedOptionId: "b" },
        { questionId: "q3", selectedOptionId: "wrong" },
      ],
      67
    );
    expect(result.scorePct).toBe(67);
    expect(result.passed).toBe(true);
  });

  it("treats an answer referencing an unknown question as incorrect, not a crash", () => {
    const result = scoreAssessment(
      questions,
      [{ questionId: "does-not-exist", selectedOptionId: "a" }],
      50
    );
    expect(result.detailed[0].correct).toBe(false);
    expect(result.detailed[0].correctOptionId).toBeUndefined();
    expect(result.scorePct).toBe(0);
  });

  it("does not divide by zero when there are no questions", () => {
    const result = scoreAssessment([], [], 80);
    expect(result.scorePct).toBe(0);
    expect(result.passed).toBe(false);
  });
});
