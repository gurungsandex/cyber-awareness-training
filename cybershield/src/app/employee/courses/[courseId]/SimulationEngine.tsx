"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Shield, BookOpen, Target, ClipboardList, Trophy,
  ChevronRight, ChevronLeft, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, Clock, Mail, Flag
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson { id: string; title: string; content: string; durationMin: number }
interface Module { id: string; title: string; lessons: Lesson[] }
interface Option { id: string; text: string }
interface Question { id: string; text: string; options: Option[]; explanation: string; correctOptionId: string }
interface Assessment { id: string; passMark: number; questions: Question[] }
interface SimEmail { subject: string; from: string; fromEmail: string; body: string; isPhishing: boolean; redFlags: string[] }
interface SimSchema { emails?: SimEmail[] }

interface Props {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  modules: Module[];
  assessment: Assessment | null;
  enrollment: { id: string; status: string; progressPct: number; simulationProgress: any };
  simulationSchema: SimSchema | null;
}

type Step = "WHY" | "LEARN" | "SIMULATE" | "ASSESS" | "CERTIFICATE";

const STEPS: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "WHY", label: "Why It Matters", icon: Shield },
  { key: "LEARN", label: "Learn", icon: BookOpen },
  { key: "SIMULATE", label: "Practice", icon: Target },
  { key: "ASSESS", label: "Quiz", icon: ClipboardList },
  { key: "CERTIFICATE", label: "Certificate", icon: Trophy },
];

// ─── Main Engine ──────────────────────────────────────────────────────────────

export function SimulationEngine({ courseId, courseTitle, courseDescription, modules, assessment, enrollment, simulationSchema }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(
    enrollment.status === "COMPLETED" ? "CERTIFICATE" : "WHY"
  );
  const [lessonIndex, setLessonIndex] = useState(0);
  const [moduleIndex, setModuleIndex] = useState(0);
  const [simChoices, setSimChoices] = useState<Record<number, "phishing" | "safe">>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allLessons = modules.flatMap((m) => m.lessons);
  const currentLesson = allLessons[lessonIndex];

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  function goTo(step: Step) {
    setCurrentStep(step);
  }

  function nextLesson() {
    if (lessonIndex < allLessons.length - 1) {
      setLessonIndex(lessonIndex + 1);
    } else {
      goTo("SIMULATE");
    }
  }

  function prevLesson() {
    if (lessonIndex > 0) setLessonIndex(lessonIndex - 1);
    else goTo("WHY");
  }

  async function submitQuiz() {
    if (!assessment) { goTo("CERTIFICATE"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setScore(data.scorePct);
      setPassed(data.passed);
      setSubmitted(true);
      if (data.passed) {
        await fetch(`/api/enrollments/${enrollment.id}/complete`, { method: "POST" });
        setTimeout(() => goTo("CERTIFICATE"), 1200);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push("/employee/courses")} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </button>
        <div className="text-center">
          <h1 className="text-sm font-heading font-semibold text-text-primary hidden sm:block">{courseTitle}</h1>
        </div>
        <div className="text-xs text-text-muted">{Math.round((stepIndex / (STEPS.length - 1)) * 100)}% complete</div>
      </div>

      {/* Step Progress */}
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="flex items-center justify-center gap-1 max-w-2xl mx-auto">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.key === currentStep;
            return (
              <div key={s.key} className="flex items-center">
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active ? "bg-accent/15 text-accent" : done ? "text-success" : "text-text-muted"
                )}>
                  <s.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px w-4 mx-1", done ? "bg-success" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === "WHY" && (
          <WhyStep title={courseTitle} description={courseDescription} onNext={() => goTo("LEARN")} />
        )}
        {currentStep === "LEARN" && currentLesson && (
          <LearnStep
            lesson={currentLesson}
            lessonIndex={lessonIndex}
            totalLessons={allLessons.length}
            onNext={nextLesson}
            onPrev={prevLesson}
          />
        )}
        {currentStep === "SIMULATE" && (
          <SimulateStep
            emails={simulationSchema?.emails ?? defaultEmails}
            choices={simChoices}
            onChoice={(i, c) => setSimChoices((prev) => ({ ...prev, [i]: c }))}
            onNext={() => goTo("ASSESS")}
            onPrev={() => { setLessonIndex(allLessons.length - 1); goTo("LEARN"); }}
          />
        )}
        {currentStep === "ASSESS" && assessment && (
          <AssessStep
            questions={assessment.questions}
            answers={answers}
            submitted={submitted}
            score={score}
            passed={passed}
            submitting={submitting}
            onAnswer={(qId, optId) => !submitted && setAnswers((prev) => ({ ...prev, [qId]: optId }))}
            onSubmit={submitQuiz}
            onRetry={() => { setAnswers({}); setSubmitted(false); setScore(null); setPassed(false); }}
            onPrev={() => goTo("SIMULATE")}
          />
        )}
        {currentStep === "ASSESS" && !assessment && (
          <div className="max-w-2xl mx-auto p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-heading font-bold text-text-primary mb-2">No quiz for this course</h2>
            <Button onClick={() => goTo("CERTIFICATE")} className="mt-4">Continue →</Button>
          </div>
        )}
        {currentStep === "CERTIFICATE" && (
          <CertificateStep courseTitle={courseTitle} passed={enrollment.status === "COMPLETED" || passed} onHome={() => router.push("/employee")} />
        )}
      </div>
    </div>
  );
}

// ─── Step: WHY ────────────────────────────────────────────────────────────────

function WhyStep({ title, description, onNext }: { title: string; description: string; onNext: () => void }) {
  const whyPoints = [
    { icon: "🎯", text: "Phishing accounts for 90% of all data breaches worldwide" },
    { icon: "💰", text: "The average cost of a phishing breach is $4.9 million" },
    { icon: "⚡", text: "Attacks are getting more sophisticated — AI-generated emails fool 78% of people" },
    { icon: "🛡️", text: "Trained employees reduce phishing success by up to 70%" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
          <Shield className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-secondary leading-relaxed">{description}</p>
      </div>

      <div className="space-y-3 mb-10">
        {whyPoints.map((p, i) => (
          <div key={i} className="flex items-start gap-4 rounded-card border border-border bg-elevated p-4">
            <span className="text-2xl">{p.icon}</span>
            <p className="text-sm text-text-secondary leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>

      <Button onClick={onNext} className="w-full gap-2">
        Start Learning <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Step: LEARN ──────────────────────────────────────────────────────────────

function LearnStep({ lesson, lessonIndex, totalLessons, onNext, onPrev }: {
  lesson: Lesson; lessonIndex: number; totalLessons: number; onNext: () => void; onPrev: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6 text-xs text-text-muted">
        <span>Lesson {lessonIndex + 1} of {totalLessons}</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lesson.durationMin} min</span>
      </div>

      <h2 className="text-xl font-heading font-semibold text-text-primary mb-6">{lesson.title}</h2>

      <div className="card-elevated p-6 mb-8 prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed">
        {lesson.content.split("\n\n").map((para, i) => (
          <p key={i} className="mb-3 last:mb-0">{para}</p>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="flex-1 gap-2">
          {lessonIndex < totalLessons - 1 ? "Next Lesson" : "Start Practice"} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step: SIMULATE ───────────────────────────────────────────────────────────

const defaultEmails: SimEmail[] = [
  {
    subject: "Urgent: Verify your account now",
    from: "IT Security Team", fromEmail: "security@micros0ft-verify.com",
    body: "Dear Employee,\n\nYour Microsoft account has been flagged for suspicious activity. Please verify your credentials immediately to avoid account suspension.\n\nClick here to verify: http://micros0ft-verify.com/login\n\nThis link expires in 2 hours.\n\nIT Security Team",
    isPhishing: true,
    redFlags: ["Misspelled domain (micros0ft-verify.com)", "Urgent language to create panic", "Generic greeting 'Dear Employee'", "Suspicious external link"],
  },
  {
    subject: "Team lunch this Friday",
    from: "Sarah Johnson", fromEmail: "sarah.johnson@yourcompany.com",
    body: "Hi team,\n\nJust a reminder about our team lunch this Friday at noon in the main conference room. Please let me know if you can attend.\n\nBest,\nSarah",
    isPhishing: false,
    redFlags: [],
  },
  {
    subject: "HR: Action required — W-2 form update",
    from: "HR Department", fromEmail: "hr-payroll@company-benefits.net",
    body: "Dear Staff,\n\nAs part of our year-end payroll processing, we need you to update your W-2 information immediately. Please provide your SSN and bank account details via the secure form below.\n\nThis is time-sensitive and mandatory for all employees.\n\nHR Payroll Team",
    isPhishing: true,
    redFlags: ["Requests sensitive personal information", "External domain (company-benefits.net)", "Creates false urgency", "Legitimate HR never asks for SSN via email"],
  },
];

function SimulateStep({ emails, choices, onChoice, onNext, onPrev }: {
  emails: SimEmail[];
  choices: Record<number, "phishing" | "safe">;
  onChoice: (i: number, c: "phishing" | "safe") => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const allAnswered = emails.every((_, i) => choices[i] !== undefined);

  const email = selected !== null ? emails[selected] : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-text-primary mb-1">Practice: Identify Phishing</h2>
        <p className="text-text-secondary text-sm">Review each email and decide: is it phishing or safe?</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Email List */}
        <div className="lg:col-span-2 space-y-2">
          {emails.map((e, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                "w-full text-left rounded-card border p-3.5 transition-colors",
                selected === i ? "border-accent bg-accent/5" : "border-border bg-elevated hover:border-accent/40"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{e.from}</span>
                </div>
                {choices[i] && (
                  choices[i] === (e.isPhishing ? "phishing" : "safe")
                    ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                    : <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-text-muted truncate">{e.subject}</p>
            </button>
          ))}
        </div>

        {/* Email Detail */}
        <div className="lg:col-span-3">
          {email !== null && selected !== null ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-medium text-text-primary text-sm">{email.subject}</h3>
                <p className="text-xs text-text-muted mt-0.5">From: {email.from} &lt;{email.fromEmail}&gt;</p>
              </div>
              <div className="px-5 py-4 border-b border-border">
                <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">{email.body}</pre>
              </div>
              <div className="px-5 py-4 flex gap-2">
                {!choices[selected] ? (
                  <>
                    <Button
                      onClick={() => { onChoice(selected, "phishing"); setRevealed((prev) => new Set([...prev, selected])); }}
                      variant="destructive"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <Flag className="h-4 w-4" /> Phishing
                    </Button>
                    <Button
                      onClick={() => { onChoice(selected, "safe"); setRevealed((prev) => new Set([...prev, selected])); }}
                      variant="success"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Safe
                    </Button>
                  </>
                ) : (
                  <div className={cn(
                    "w-full rounded-lg p-3 text-sm font-medium flex items-center gap-2",
                    choices[selected] === (email.isPhishing ? "phishing" : "safe")
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-danger/10 text-danger border border-danger/20"
                  )}>
                    {choices[selected] === (email.isPhishing ? "phishing" : "safe")
                      ? <><CheckCircle2 className="h-4 w-4" /> Correct!</>
                      : <><XCircle className="h-4 w-4" /> Incorrect — this was {email.isPhishing ? "phishing" : "a safe email"}</>
                    }
                  </div>
                )}
              </div>
              {revealed.has(selected) && email.isPhishing && email.redFlags.length > 0 && (
                <div className="mx-5 mb-5 rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Red Flags
                  </p>
                  <ul className="space-y-1">
                    {email.redFlags.map((f, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                        <span className="text-warning mt-0.5">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="card flex items-center justify-center h-40 text-text-muted">
              <div className="text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Select an email to review it</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="flex-1 gap-2" disabled={!allAnswered}>
          {allAnswered ? "Proceed to Quiz" : `Classify all ${emails.length} emails to continue`}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step: ASSESS ─────────────────────────────────────────────────────────────

function AssessStep({ questions, answers, submitted, score, passed, submitting, onAnswer, onSubmit, onRetry, onPrev }: {
  questions: Question[];
  answers: Record<string, string>;
  submitted: boolean;
  score: number | null;
  passed: boolean;
  submitting: boolean;
  onAnswer: (qId: string, optId: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onPrev: () => void;
}) {
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-text-primary mb-1">Knowledge Quiz</h2>
        <p className="text-text-secondary text-sm">{answeredCount} of {questions.length} answered</p>
      </div>

      {submitted && score !== null && (
        <div className={cn(
          "rounded-card border p-4 mb-6 flex items-center gap-3",
          passed ? "border-success/20 bg-success/10" : "border-danger/20 bg-danger/10"
        )}>
          {passed
            ? <><CheckCircle2 className="h-6 w-6 text-success" /><div><p className="font-semibold text-success">Passed! Score: {score}%</p><p className="text-xs text-text-secondary">Great work — your certificate is ready.</p></div></>
            : <><XCircle className="h-6 w-6 text-danger" /><div><p className="font-semibold text-danger">Score: {score}% — Need 80% to pass</p><p className="text-xs text-text-secondary">Review the explanations and try again.</p></div></>
          }
        </div>
      )}

      <div className="space-y-5 mb-8">
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="card-elevated p-5">
              <p className="text-sm font-medium text-text-primary mb-4">
                <span className="text-text-muted mr-2">{qi + 1}.</span>{q.text}
              </p>
              <div className="space-y-2">
                {(q.options as Option[]).map((opt) => {
                  const isSelected = selected === opt.id;
                  const isCorrect = submitted && opt.id === q.correctOptionId;
                  const isWrong = submitted && isSelected && opt.id !== q.correctOptionId;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onAnswer(q.id, opt.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors",
                        isCorrect ? "border-success bg-success/10 text-success" :
                        isWrong ? "border-danger bg-danger/10 text-danger" :
                        isSelected ? "border-accent bg-accent/10 text-accent" :
                        "border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                      )}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
              {submitted && selected && (
                <p className="mt-3 text-xs text-text-muted border-t border-border pt-3 leading-relaxed">
                  <span className="font-medium text-text-secondary">Explanation: </span>{q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        {!submitted ? (
          <>
            <Button variant="outline" onClick={onPrev} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={onSubmit} className="flex-1" disabled={!allAnswered || submitting}>
              {submitting ? "Submitting…" : `Submit Quiz (${answeredCount}/${questions.length})`}
            </Button>
          </>
        ) : !passed ? (
          <Button onClick={onRetry} variant="outline" className="flex-1 gap-2">
            Try Again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Step: CERTIFICATE ────────────────────────────────────────────────────────

function CertificateStep({ courseTitle, passed, onHome }: { courseTitle: string; passed: boolean; onHome: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 border border-success/20 mb-6">
        <Trophy className="h-10 w-10 text-success" />
      </div>
      <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
        {passed ? "Course Complete!" : "Course Progress Saved"}
      </h2>
      <p className="text-text-secondary mb-8">
        {passed
          ? `You've successfully completed "${courseTitle}". Your certificate has been issued.`
          : `You're making progress on "${courseTitle}". Keep going!`}
      </p>

      {passed && (
        <div className="card border-success/20 bg-success/5 p-6 mb-8 text-left">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-success" />
            <div>
              <p className="font-semibold text-text-primary">Certificate of Completion</p>
              <p className="text-xs text-text-muted">{courseTitle}</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Your certificate has been generated and is available in your <strong className="text-text-primary">Certificates</strong> section.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={onHome} variant="outline" className="flex-1">
          Back to Dashboard
        </Button>
        {passed && (
          <Button onClick={() => window.location.href = "/employee/certificates"} className="flex-1 gap-2">
            <Trophy className="h-4 w-4" /> View Certificates
          </Button>
        )}
      </div>
    </div>
  );
}
