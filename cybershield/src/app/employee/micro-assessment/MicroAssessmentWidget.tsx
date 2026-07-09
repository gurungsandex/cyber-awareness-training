"use client";
import { useState } from "react";
import { Brain, ChevronRight, CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  onDismiss: () => void;
}

export function MicroAssessmentWidget({ courseTitle, enrollmentId, questions, onDismiss }: Props) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  function handleReveal() {
    if (!selected) return;
    if (selected === q.correctOptionId) setScore((s) => s + 1);
    setRevealed(true);
  }

  function handleNext() {
    if (isLast) {
      setDone(true);
    } else {
      setCurrent((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-card border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">Knowledge Check Complete</span>
          </div>
          <button onClick={onDismiss} className="p-1 rounded hover:bg-elevated text-text-muted" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={cn("rounded-lg border p-3 flex items-center gap-3 text-sm",
          pct >= 80 ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"
        )}>
          {pct >= 80
            ? <><CheckCircle2 className="h-5 w-5 text-success" /><span className="text-text-primary">Great retention! You scored <strong>{pct}%</strong> on your {courseTitle} micro-check.</span></>
            : <><XCircle className="h-5 w-5 text-warning" /><span className="text-text-primary">Score: <strong>{pct}%</strong> — consider reviewing <strong>{courseTitle}</strong> to reinforce your knowledge.</span></>
          }
        </div>
        <Button size="sm" variant="outline" onClick={onDismiss} className="mt-3 w-full">Dismiss</Button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <div>
            <span className="text-sm font-medium text-text-primary">Knowledge Retention Check</span>
            <p className="text-xs text-text-muted">{courseTitle} · {current + 1}/{questions.length}</p>
          </div>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="p-1 rounded hover:bg-elevated text-text-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-sm text-text-primary font-medium mb-3 leading-relaxed">{q.text}</p>

      <div className="space-y-2 mb-4">
        {q.options.map((opt) => {
          const isSelected = selected === opt.id;
          const isCorrect = revealed && opt.id === q.correctOptionId;
          const isWrong = revealed && isSelected && opt.id !== q.correctOptionId;
          return (
            <button
              key={opt.id}
              disabled={revealed}
              onClick={() => setSelected(opt.id)}
              className={cn(
                "w-full text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors",
                isCorrect ? "border-success bg-success/10 text-success" :
                isWrong ? "border-danger bg-danger/10 text-danger" :
                isSelected ? "border-accent bg-accent/10 text-accent" :
                "border-border text-text-secondary hover:border-accent/30"
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {revealed && (
        <p className="text-xs text-text-muted bg-elevated rounded-lg px-3 py-2 mb-3 leading-relaxed">
          {q.explanation}
        </p>
      )}

      <div className="flex gap-2">
        {!revealed ? (
          <Button size="sm" onClick={handleReveal} disabled={!selected} className="flex-1">
            Check Answer
          </Button>
        ) : (
          <Button size="sm" onClick={handleNext} className="flex-1 gap-1.5">
            {isLast ? "See Results" : "Next Question"} <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
