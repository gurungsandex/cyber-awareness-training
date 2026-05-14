"use client";
import { useState } from "react";
import { MicroAssessmentWidget } from "./MicroAssessmentWidget";

interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

interface Props {
  courseTitle: string;
  enrollmentId: string;
  questions: Question[];
}

export function MicroAssessmentBanner({ courseTitle, enrollmentId, questions }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || questions.length === 0) return null;

  return (
    <MicroAssessmentWidget
      courseTitle={courseTitle}
      enrollmentId={enrollmentId}
      questions={questions}
      onDismiss={() => setDismissed(true)}
    />
  );
}
