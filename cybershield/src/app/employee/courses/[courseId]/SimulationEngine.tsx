"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Shield, BookOpen, Target, ClipboardList, Trophy,
  ChevronRight, ChevronLeft, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, Clock, Mail, Globe,
  Lock, Smartphone, FileWarning, Database, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson { id: string; title: string; content: string; durationMin: number }
interface Module { id: string; title: string; lessons: Lesson[] }
interface Option { id: string; text: string }
interface Question { id: string; text: string; options: Option[]; explanation: string; correctOptionId: string }
interface Assessment { id: string; passMark: number; questions: Question[] }
interface SimEmail { subject: string; from: string; fromEmail: string; body: string; isPhishing: boolean; redFlags: string[] }
interface SimSchema { emails?: SimEmail[]; type?: string }

interface Props {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  modules: Module[];
  assessment: Assessment | null;
  enrollment: { id: string; status: string; progressPct: number; simulationProgress: any };
  simulationSchema: SimSchema | null;
  isPreview?: boolean;
}

type Step = "WHY" | "LEARN" | "SIMULATE" | "ASSESS" | "CERTIFICATE";

const STEPS: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "WHY",         label: "Why It Matters", icon: Shield },
  { key: "LEARN",       label: "Learn",          icon: BookOpen },
  { key: "SIMULATE",    label: "Practice",       icon: Target },
  { key: "ASSESS",      label: "Quiz",           icon: ClipboardList },
  { key: "CERTIFICATE", label: "Certificate",    icon: Trophy },
];

// ─── Simulation selector ─────────────────────────────────────────────────────

function getSimulationType(courseId: string): string {
  if (courseId.includes("phishing"))  return "PHISHING_EMAIL";
  if (courseId.includes("password") || courseId.includes("mfa")) return "PASSWORD_MFA";
  if (courseId.includes("social"))    return "SOCIAL_ENGINEERING";
  if (courseId.includes("browsing"))  return "SAFE_BROWSING";
  if (courseId.includes("data"))      return "DATA_PROTECTION";
  if (courseId.includes("ransomware")) return "RANSOMWARE";
  if (courseId.includes("mobile") || courseId.includes("remote")) return "MOBILE_REMOTE";
  if (courseId.includes("incident"))  return "INCIDENT_RESPONSE";
  return "PHISHING_EMAIL";
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export function SimulationEngine({
  courseId, courseTitle, courseDescription,
  modules, assessment, enrollment, simulationSchema, isPreview,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(
    enrollment.status === "COMPLETED" ? "CERTIFICATE" : "WHY"
  );
  const [lessonIndex, setLessonIndex] = useState(0);
  const [simComplete, setSimComplete] = useState(false);
  const [answers, setAnswers]         = useState<Record<string, string>>({});
  const [submitted, setSubmitted]     = useState(false);
  const [score, setScore]             = useState<number | null>(null);
  const [passed, setPassed]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const allLessons    = modules.flatMap((m) => m.lessons);
  const currentLesson = allLessons[lessonIndex];
  const stepIndex     = STEPS.findIndex((s) => s.key === currentStep);
  const simType       = getSimulationType(courseId);

  function goTo(step: Step) { setCurrentStep(step); }

  function nextLesson() {
    if (lessonIndex < allLessons.length - 1) setLessonIndex(lessonIndex + 1);
    else goTo("SIMULATE");
  }
  function prevLesson() {
    if (lessonIndex > 0) setLessonIndex(lessonIndex - 1);
    else goTo("WHY");
  }

  async function submitQuiz() {
    if (!assessment) { goTo("CERTIFICATE"); return; }
    setSubmitting(true);
    try {
      if (isPreview) {
        const correct = assessment.questions.filter((q) => answers[q.id] === q.correctOptionId).length;
        const pct  = Math.round((correct / assessment.questions.length) * 100);
        const pass = pct >= (assessment.passMark ?? 80);
        setScore(pct); setPassed(pass); setSubmitted(true);
        if (pass) setTimeout(() => goTo("CERTIFICATE"), 1200);
        return;
      }
      const res  = await fetch(`/api/assessments/${assessment.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setScore(data.scorePct); setPassed(data.passed); setSubmitted(true);
      if (data.passed) {
        await fetch(`/api/enrollments/${enrollment.id}/complete`, { method: "POST" });
        setTimeout(() => goTo("CERTIFICATE"), 1200);
      }
    } catch (e) { console.error(e); }
    finally     { setSubmitting(false); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Preview Banner */}
      {isPreview && (
        <div className="bg-accent/10 border-b border-accent/20 px-6 py-2 flex items-center justify-center gap-2">
          <Shield className="h-3.5 w-3.5 text-accent flex-shrink-0" />
          <span className="text-xs font-medium text-accent">Admin Preview — progress will not be saved</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-sm font-heading font-semibold text-text-primary hidden sm:block">{courseTitle}</h1>
        <div className="text-xs text-text-muted tabular-nums">{Math.round((stepIndex / (STEPS.length - 1)) * 100)}%</div>
      </div>

      {/* Step Progress */}
      <div className="bg-surface border-b border-border px-6 py-2.5">
        <div className="flex items-center max-w-lg mx-auto">
          {STEPS.map((s, i) => {
            const done   = i < stepIndex;
            const active = s.key === currentStep;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                    active ? "bg-accent text-white shadow-sm" : done ? "bg-success/20 text-success" : "bg-border text-text-muted"
                  )}>
                    {done
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : <s.icon className="h-3 w-3" />
                    }
                  </div>
                  <span className={cn("text-[10px] font-medium hidden sm:block whitespace-nowrap",
                    active ? "text-accent" : done ? "text-success" : "text-text-muted"
                  )}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px mx-1.5", done ? "bg-success/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === "WHY" && (
          <WhyStep courseId={courseId} title={courseTitle} description={courseDescription} onNext={() => goTo("LEARN")} />
        )}
        {currentStep === "LEARN" && currentLesson && (
          <LearnStep lesson={currentLesson} lessonIndex={lessonIndex} totalLessons={allLessons.length} onNext={nextLesson} onPrev={prevLesson} />
        )}
        {currentStep === "SIMULATE" && (
          <SimulateRouter
            simType={simType}
            simulationSchema={simulationSchema}
            onComplete={() => { setSimComplete(true); goTo("ASSESS"); }}
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
            <h2 className="text-xl font-heading font-bold text-text-primary mb-2">Practice complete</h2>
            <Button onClick={() => goTo("CERTIFICATE")} className="mt-4">Continue →</Button>
          </div>
        )}
        {currentStep === "CERTIFICATE" && (
          <CertificateStep
            courseTitle={courseTitle}
            passed={enrollment.status === "COMPLETED" || passed}
            isPreview={isPreview}
            onHome={() => router.push("/employee")}
          />
        )}
      </div>
    </div>
  );
}

// ─── SimulateRouter ───────────────────────────────────────────────────────────

function SimulateRouter({ simType, simulationSchema, onComplete, onPrev }: {
  simType: string; simulationSchema: SimSchema | null; onComplete: () => void; onPrev: () => void;
}) {
  switch (simType) {
    case "PHISHING_EMAIL":     return <PhishingEmailSim emails={simulationSchema?.emails ?? defaultPhishingEmails} onComplete={onComplete} onPrev={onPrev} />;
    case "PASSWORD_MFA":       return <PasswordMFASim onComplete={onComplete} onPrev={onPrev} />;
    case "SOCIAL_ENGINEERING": return <SocialEngineeringSim onComplete={onComplete} onPrev={onPrev} />;
    case "SAFE_BROWSING":      return <SafeBrowsingSim onComplete={onComplete} onPrev={onPrev} />;
    case "DATA_PROTECTION":    return <DataProtectionSim onComplete={onComplete} onPrev={onPrev} />;
    case "RANSOMWARE":         return <RansomwareSim onComplete={onComplete} onPrev={onPrev} />;
    case "MOBILE_REMOTE":      return <MobileRemoteSim onComplete={onComplete} onPrev={onPrev} />;
    case "INCIDENT_RESPONSE":  return <IncidentResponseSim onComplete={onComplete} onPrev={onPrev} />;
    default:                   return <PhishingEmailSim emails={defaultPhishingEmails} onComplete={onComplete} onPrev={onPrev} />;
  }
}

// ─── Step: WHY ────────────────────────────────────────────────────────────────

const WHY_POINTS: Record<string, { icon: string; text: string }[]> = {
  "phishing": [
    { icon: "🎯", text: "Phishing accounts for 90% of all data breaches worldwide" },
    { icon: "💰", text: "The average cost of a phishing breach is $4.9 million" },
    { icon: "⚡", text: "AI-generated phishing emails fool 78% of unprepared employees" },
    { icon: "🛡️", text: "Trained employees reduce phishing success by up to 70%" },
  ],
  "password": [
    { icon: "🔐", text: "Over 24 billion username/password pairs are actively sold on criminal markets" },
    { icon: "⚡", text: "Modern hardware can test 10 billion password guesses per second" },
    { icon: "🔁", text: "Password reuse turns one breach into ten — attackers rely on it" },
    { icon: "🛡️", text: "MFA blocks 99.9% of automated account-compromise attacks" },
  ],
  "social": [
    { icon: "🧠", text: "Social engineering bypasses technical security by exploiting human psychology" },
    { icon: "💸", text: "Business Email Compromise has caused $50+ billion in global losses" },
    { icon: "🎭", text: "Attackers research targets on LinkedIn before launching targeted attacks" },
    { icon: "🛡️", text: "The Pause Principle — stopping to verify — stops most social engineering attacks" },
  ],
  "browsing": [
    { icon: "🔒", text: "HTTPS padlock means encrypted — not safe. Phishing sites use HTTPS too" },
    { icon: "🦠", text: "Drive-by malware can install just by visiting a compromised site" },
    { icon: "📢", text: "Malvertising serves malware through ads on trusted, mainstream websites" },
    { icon: "🛡️", text: "Verifying the URL domain before entering credentials prevents most web-based attacks" },
  ],
  "data": [
    { icon: "⚖️", text: "GDPR fines reach up to 4% of global annual turnover — or €20 million" },
    { icon: "🔍", text: "A single mishandled spreadsheet of customer records can trigger a full investigation" },
    { icon: "⏱️", text: "You have just 72 hours to report a personal data breach to the regulator" },
    { icon: "🛡️", text: "Correct data classification and access controls prevent most breaches" },
  ],
  "ransomware": [
    { icon: "💰", text: "Average ransomware attack total cost: $4.5 million including downtime" },
    { icon: "📧", text: "41% of ransomware enters via phishing email — one click, millions in damage" },
    { icon: "⏳", text: "Attackers dwell in networks 16 days on average before deploying ransomware" },
    { icon: "🛡️", text: "Never enabling macros in unexpected documents blocks the most common delivery method" },
  ],
  "mobile": [
    { icon: "☕", text: "Evil twin WiFi hotspots in coffee shops intercept all unencrypted traffic" },
    { icon: "📱", text: "A stolen work device gives attackers access to all connected corporate systems" },
    { icon: "🏠", text: "Your home network is now a branch office — and a potential entry point" },
    { icon: "🛡️", text: "VPN + device encryption + remote wipe neutralise most mobile/remote risks" },
  ],
  "incident": [
    { icon: "⏱️", text: "Every hour of delay in incident reporting costs an average of $250,000 more" },
    { icon: "🦠", text: "Undetected attackers escalate from initial access to full-network control in 16 days" },
    { icon: "🚨", text: "Most catastrophic breaches involve a week+ of silence after the initial compromise" },
    { icon: "🛡️", text: "Fast reporting + network isolation contain breaches before they become disasters" },
  ],
};

function WhyStep({ courseId, title, description, onNext }: {
  courseId: string; title: string; description: string; onNext: () => void;
}) {
  const key    = Object.keys(WHY_POINTS).find((k) => courseId.includes(k)) ?? "phishing";
  const points = WHY_POINTS[key];

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
        {points.map((p, i) => (
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

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderContent(content: string): React.ReactNode[] {
  const blocks = content.split("\n\n").filter(Boolean);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();

    // H1 — skip if it just repeats the lesson title
    if (block.startsWith("# ")) {
      const text = block.slice(2).trim();
      nodes.push(
        <h2 key={i} className="text-lg font-heading font-bold text-text-primary mt-2 mb-1">
          {text}
        </h2>
      );
      continue;
    }

    // H2 — may have content flowing after the heading on the same paragraph
    if (block.startsWith("## ")) {
      const rest = block.slice(3).trim();
      // Split on first sentence-end or dash to separate heading from body
      const dotIdx  = rest.search(/[.?!]\s+[A-Z*]/);
      const heading = dotIdx > -1 ? rest.slice(0, dotIdx + 1).trim() : rest;
      const body    = dotIdx > -1 ? rest.slice(dotIdx + 1).trim()    : "";

      nodes.push(
        <div key={i} className="mt-5 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 rounded-full bg-accent flex-shrink-0" />
            <h3 className="text-sm font-heading font-bold text-accent uppercase tracking-wide">{heading}</h3>
          </div>
          {body && <p className="text-sm text-text-secondary leading-relaxed">{renderInline(body)}</p>}
        </div>
      );
      continue;
    }

    // Bold label with dash-separated bullet items: **Label:** – item – item
    const boldLabelMatch = block.match(/^\*\*(.+?):\*\*\s*[–-]\s*(.+)/);
    if (boldLabelMatch) {
      const label = boldLabelMatch[1];
      const rest  = boldLabelMatch[2];
      // Split on em dash or hyphen surrounded by spaces
      const items = rest.split(/\s+[–-]\s+/).filter(Boolean);

      nodes.push(
        <div key={i} className="mt-3">
          <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">{label}</p>
          <ul className="space-y-1.5">
            {items.map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/60 flex-shrink-0" />
                <span>{renderInline(item.trim())}</span>
              </li>
            ))}
          </ul>
        </div>
      );
      continue;
    }

    // Standalone bold text (no dashes) — treat as a callout/highlight
    if (block.startsWith("**") && block.endsWith("**") && !block.slice(2, -2).includes("**")) {
      nodes.push(
        <div key={i} className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="text-sm font-semibold text-accent leading-relaxed">{block.slice(2, -2)}</p>
        </div>
      );
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-sm text-text-secondary leading-relaxed mt-3">
        {renderInline(block)}
      </p>
    );
  }

  return nodes;
}

function LearnStep({ lesson, lessonIndex, totalLessons, onNext, onPrev }: {
  lesson: Lesson; lessonIndex: number; totalLessons: number; onNext: () => void; onPrev: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Lesson meta */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalLessons }).map((_, i) => (
            <div key={i} className={cn(
              "rounded-full transition-all duration-200",
              i === lessonIndex ? "w-5 h-2 bg-accent" : i < lessonIndex ? "w-2 h-2 bg-success" : "w-2 h-2 bg-border"
            )} />
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" />{lesson.durationMin} min
        </span>
      </div>

      <h2 className="text-xl font-heading font-semibold text-text-primary mb-5">{lesson.title}</h2>

      {/* Content card */}
      <div className="bg-surface rounded-card border border-border overflow-hidden mb-7 shadow-card">
        <div className="h-0.5 bg-accent" style={{ width: `${((lessonIndex + 1) / totalLessons) * 100}%` }} />
        <div className="p-6">
          {renderContent(lesson.content)}
        </div>
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

// ─── SIMULATION 1: Phishing Email ─────────────────────────────────────────────

interface SimEmail { subject: string; from: string; fromEmail: string; body: string; isPhishing: boolean; redFlags: string[] }

const defaultPhishingEmails: SimEmail[] = [
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

function PhishingEmailSim({ emails, onComplete, onPrev }: {
  emails: SimEmail[]; onComplete: () => void; onPrev: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [choices, setChoices]   = useState<Record<number, "phishing" | "safe">>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const allAnswered = emails.every((_, i) => choices[i] !== undefined);
  const email = selected !== null ? emails[selected] : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-text-primary mb-1">Practice: Identify Phishing Emails</h2>
        <p className="text-text-secondary text-sm">Review each email carefully and decide whether it is a phishing attempt or a legitimate message.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-2">
          {emails.map((e, i) => (
            <button key={i} onClick={() => setSelected(i)} className={cn(
              "w-full text-left rounded-card border p-3.5 transition-colors",
              selected === i ? "border-accent bg-accent/5" : "border-border bg-elevated hover:border-accent/40"
            )}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{e.from}</span>
                </div>
                {choices[i] && (choices[i] === (e.isPhishing ? "phishing" : "safe")
                  ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  : <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-text-muted truncate">{e.subject}</p>
            </button>
          ))}
        </div>

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
                    <Button onClick={() => { setChoices((p) => ({ ...p, [selected]: "phishing" })); setRevealed((p) => new Set([...p, selected])); }} variant="destructive" size="sm" className="flex-1 gap-2">
                      <AlertTriangle className="h-4 w-4" /> Mark as Phishing
                    </Button>
                    <Button onClick={() => { setChoices((p) => ({ ...p, [selected]: "safe" })); setRevealed((p) => new Set([...p, selected])); }} variant="success" size="sm" className="flex-1 gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Mark as Safe
                    </Button>
                  </>
                ) : (
                  <div className={cn("w-full rounded-lg p-3 text-sm font-medium flex items-center gap-2",
                    choices[selected] === (email.isPhishing ? "phishing" : "safe")
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-danger/10 text-danger border border-danger/20"
                  )}>
                    {choices[selected] === (email.isPhishing ? "phishing" : "safe")
                      ? <><CheckCircle2 className="h-4 w-4" /> Correct!</>
                      : <><XCircle className="h-4 w-4" /> Incorrect — this was {email.isPhishing ? "a phishing email" : "a safe email"}</>
                    }
                  </div>
                )}
              </div>
              {revealed.has(selected) && email.isPhishing && email.redFlags.length > 0 && (
                <div className="mx-5 mb-5 rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Red Flags in This Email
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
        <Button variant="outline" onClick={onPrev} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
        <Button onClick={onComplete} className="flex-1 gap-2" disabled={!allAnswered}>
          {allAnswered ? "Proceed to Quiz" : `Classify all ${emails.length} emails to continue`}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── SIMULATION 2: Scenario template ─────────────────────────────────────────

interface ScenarioQuestion {
  id: string;
  prompt: string;
  context?: string;
  choices: { id: string; label: string; correct: boolean; explanation: string }[];
}

function ScenarioSim({ title, icon, scenarios, onComplete, onPrev }: {
  title: string; icon: React.ReactNode; scenarios: ScenarioQuestion[]; onComplete: () => void; onPrev: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected]         = useState<string | null>(null);
  const [revealed, setRevealed]         = useState(false);
  const [score, setScore]               = useState(0);

  const scenario = scenarios[currentIndex];
  const isLast   = currentIndex === scenarios.length - 1;
  const chosen   = scenario.choices.find((c) => c.id === selected);

  function handleReveal() {
    if (!selected) return;
    const correct = scenario.choices.find((c) => c.id === selected)?.correct ?? false;
    if (correct) setScore((s) => s + 1);
    setRevealed(true);
  }

  function handleNext() {
    if (isLast) { onComplete(); return; }
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {icon}
          <h2 className="text-xl font-heading font-semibold text-text-primary">{title}</h2>
        </div>
        <p className="text-text-secondary text-sm">
          Scenario {currentIndex + 1} of {scenarios.length} — choose the correct action.
        </p>
      </div>

      <div className="card-elevated p-6 mb-6">
        {scenario.context && (
          <div className="rounded-lg bg-accent/5 border border-accent/20 px-4 py-3 mb-4 text-sm text-text-secondary">
            {scenario.context}
          </div>
        )}
        <p className="text-text-primary font-medium leading-relaxed mb-5">{scenario.prompt}</p>

        <div className="space-y-2.5">
          {scenario.choices.map((choice) => {
            const isSelected = selected === choice.id;
            const isCorrect  = revealed && choice.correct;
            const isWrong    = revealed && isSelected && !choice.correct;

            return (
              <button
                key={choice.id}
                onClick={() => { if (!revealed) setSelected(choice.id); }}
                disabled={revealed}
                className={cn(
                  "w-full text-left rounded-xl border px-5 py-3.5 text-sm transition-all",
                  isCorrect  ? "border-success bg-success/10 text-success" :
                  isWrong    ? "border-danger bg-danger/10 text-danger" :
                  isSelected ? "border-accent bg-accent/10 text-accent" :
                  revealed   ? "border-border text-text-muted opacity-60" :
                               "border-border text-text-secondary hover:border-accent/50 hover:text-text-primary hover:bg-elevated/50 cursor-pointer"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                    isCorrect  ? "border-success bg-success/20" :
                    isWrong    ? "border-danger bg-danger/20" :
                    isSelected ? "border-accent bg-accent/20" : "border-current"
                  )}>
                    {isCorrect && <CheckCircle2 className="h-3 w-3" />}
                    {isWrong   && <XCircle className="h-3 w-3" />}
                  </span>
                  <span className="leading-snug">{choice.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {revealed && chosen && (
          <div className={cn(
            "mt-5 rounded-lg border p-4 text-sm",
            chosen.correct ? "border-success/20 bg-success/5 text-text-secondary" : "border-danger/20 bg-danger/5 text-text-secondary"
          )}>
            <p className="font-semibold mb-1 flex items-center gap-2">
              {chosen.correct
                ? <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-success">Correct</span></>
                : <><XCircle className="h-4 w-4 text-danger" /><span className="text-danger">Incorrect</span></>
              }
            </p>
            <p className="leading-relaxed">{chosen.explanation}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {currentIndex === 0 && !revealed && (
          <Button variant="outline" onClick={onPrev} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
        )}
        {!revealed ? (
          <Button onClick={handleReveal} disabled={!selected} className="flex-1">Confirm Answer</Button>
        ) : (
          <Button onClick={handleNext} className="flex-1 gap-2">
            {isLast ? "Proceed to Quiz" : "Next Scenario"} <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Scenario data ────────────────────────────────────────────────────────────

const PASSWORD_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "pw1", prompt: "You need to create a new password for your work email account. Which of these should you choose?",
    context: "Your company's IT policy requires a password of at least 12 characters.",
    choices: [
      { id: "a", label: "Company2024!", correct: false, explanation: "This is extremely predictable — company name + year is one of the first patterns attackers try. It's also a common pattern in dictionary attack lists." },
      { id: "b", label: "P@ssw0rd",    correct: false, explanation: "This is the most commonly used 'complex' password pattern and is in every attacker's dictionary. Character substitutions (@ for a, 0 for o) do not add security." },
      { id: "c", label: "CorrectHorseBatteryStaple#7", correct: true, explanation: "Correct! Four random words combined create a passphrase that is both memorable and extremely difficult to crack. At 26+ characters it would take centuries to brute-force." },
      { id: "d", label: "qwerty123",   correct: false, explanation: "Keyboard walks and sequential numbers are trivially easy to crack — they're tested in the first seconds of any brute-force attack." },
    ],
  },
  {
    id: "pw2", prompt: "You receive 12 push notification MFA approval requests in rapid succession at 2am that you did not initiate. What do you do?",
    choices: [
      { id: "a", label: "Approve one to stop the notifications",                                correct: false, explanation: "This is exactly what the attacker wants. Approving gives them full access to your account. This is called an MFA fatigue attack." },
      { id: "b", label: "Deny all — change your password immediately and report it to security", correct: true,  explanation: "Correct! This is an MFA fatigue attack. Deny all, change your password, and report to IT — someone has your credentials." },
      { id: "c", label: "Ignore the notifications and go back to sleep",                        correct: false, explanation: "Ignoring leaves the attacker trying indefinitely. You may eventually accidentally approve one." },
      { id: "d", label: "Turn off MFA to stop the notifications",                               correct: false, explanation: "Disabling MFA removes the one protection stopping the attacker from accessing your account right now." },
    ],
  },
  {
    id: "pw3", prompt: "Your colleague says they forgot their password and asks you to share yours temporarily. What do you do?",
    choices: [
      { id: "a", label: "Share it — you trust them and they only need it briefly",      correct: false, explanation: "Never share your password with anyone. All actions traced to your account become your responsibility." },
      { id: "b", label: "Share just your username and let them guess the password",     correct: false, explanation: "Providing any credential information is a security violation." },
      { id: "c", label: "Direct them to IT to reset their own password — takes 5 minutes", correct: true, explanation: "Correct! IT can reset a password in minutes with proper identity verification. Sharing passwords is a policy violation regardless of intent." },
      { id: "d", label: "Create a temporary shared password you both know",             correct: false, explanation: "Creating shared credentials violates password security policy and creates untrackable access." },
    ],
  },
];

const SOCIAL_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "se1", prompt: "A caller identifies themselves as 'James from IT' and says they need your password to apply an emergency security patch. They sound professional and urgent. What do you do?",
    choices: [
      { id: "a", label: "Give them the password — security patches are important",                               correct: false, explanation: "IT will never need your password. This is a classic vishing (voice phishing) attack." },
      { id: "b", label: "Ask for their employee ID and then provide the password",                               correct: false, explanation: "Employee IDs can be easily guessed. Even with an ID, legitimate IT do not need your password." },
      { id: "c", label: "Decline, hang up, and call the IT helpdesk directly using the number from your company directory", correct: true, explanation: "Correct! Hang up and call IT on a number you look up independently. Attackers get angry when you do this — which is itself a red flag." },
      { id: "d", label: "Put them on hold and ask a colleague what to do",                                       correct: false, explanation: "The correct action is always to verify through official channels yourself." },
    ],
  },
  {
    id: "se2", prompt: "An email appears to be from your CEO marked 'CONFIDENTIAL'. It requests an urgent £15,000 wire transfer. They say not to call as they're in back-to-back meetings. What do you do?",
    choices: [
      { id: "a", label: "Process the transfer — it's from the CEO and marked confidential",                     correct: false, explanation: "This is Business Email Compromise (BEC). The 'don't call' instruction is a manipulation technique." },
      { id: "b", label: "Reply to the email asking for more details before transferring",                        correct: false, explanation: "Replying keeps you in the attacker's controlled channel." },
      { id: "c", label: "Verify by calling the CEO directly on their known phone number — regardless of the email instruction", correct: true, explanation: "Correct! Always verify unusual financial requests through an independent channel. No CEO can override financial controls." },
      { id: "d", label: "Ask your manager to authorise the transfer since the CEO can't be reached",            correct: false, explanation: "Escalating within the compromised email thread still uses the attacker's false narrative." },
    ],
  },
  {
    id: "se3", prompt: "You're entering the office and someone behind you is carrying boxes and can't badge in. They smile and say 'Could you hold the door?' What do you do?",
    choices: [
      { id: "a", label: "Hold the door open — it would be rude not to help",                  correct: false, explanation: "This is tailgating. Politeness is a social engineering weapon. Everyone must badge in separately." },
      { id: "b", label: "Hold the door but ask their name to mention to reception",            correct: false, explanation: "Still allows unauthorised access." },
      { id: "c", label: "Politely decline and direct them to reception to get proper access",  correct: true,  explanation: "Correct! Every person must badge through access control independently. Legitimate contractors understand this." },
      { id: "d", label: "Let them in this time and report it to security later",               correct: false, explanation: "By then the attacker may have already accessed sensitive areas." },
    ],
  },
];

const DATA_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "dp1", prompt: "A colleague asks you to email them a spreadsheet containing 500 customer records including names, emails, and purchase history so they can work on it from home tonight. What do you do?",
    choices: [
      { id: "a", label: "Email the spreadsheet — they're a trusted colleague",                                          correct: false, explanation: "Emailing unencrypted personal data is a data protection violation regardless of trust." },
      { id: "b", label: "Zip the file with a password and email it",                                                    correct: false, explanation: "Password-protected ZIP files provide minimal security and are still transmitted over unencrypted email." },
      { id: "c", label: "Share it via the company's secure file-sharing platform (SharePoint/Teams) with appropriate access controls", correct: true, explanation: "Correct! Approved platforms provide access control, audit trails, and encryption. This is correct data handling procedure." },
      { id: "d", label: "Send only the columns they need, removing the sensitive ones",                                 correct: false, explanation: "Data minimisation is good practice, but this doesn't resolve the insecure transmission issue." },
    ],
  },
  {
    id: "dp2", prompt: "You realise you accidentally sent an email containing a patient's medical records to the wrong recipient 30 minutes ago. What is your first action?",
    choices: [
      { id: "a", label: "Email the wrong recipient and ask them to delete it — problem solved",          correct: false, explanation: "Asking for deletion does not undo the breach. You have a legal obligation to report this regardless." },
      { id: "b", label: "Wait to see if anyone reports it before escalating",                            correct: false, explanation: "GDPR requires notification to the supervisory authority within 72 hours. Delays worsen penalties." },
      { id: "c", label: "Report it to your manager and Data Protection Officer immediately — it's a notifiable data breach", correct: true, explanation: "Correct! Speed is critical — swift reporting demonstrates compliance and limits penalties." },
      { id: "d", label: "Delete your sent email and hope nobody notices",                                correct: false, explanation: "Attempting to cover up a breach dramatically increases penalties." },
    ],
  },
  {
    id: "dp3", prompt: "A customer calls and verbally requests a copy of all personal data your company holds about them. This is a Subject Access Request. What do you do?",
    choices: [
      { id: "a", label: "Tell them you need 90 days to process the request",                                        correct: false, explanation: "The legal deadline is 30 days, not 90. Misquoting creates legal liability." },
      { id: "b", label: "Ask them to email the request to you directly and handle it yourself",                     correct: false, explanation: "SARs must be formally logged and handled by the DPO, not individually." },
      { id: "c", label: "Note the request, confirm you've received it, and forward it to your Data Protection Officer immediately", correct: true, explanation: "Correct! The 30-day clock starts from when the request is received. Correct handling protects both the customer and the organisation." },
      { id: "d", label: "Explain that you can only process written requests and end the call",                      correct: false, explanation: "Under GDPR, Subject Access Requests are valid regardless of format — verbal, written, or through social media." },
    ],
  },
];

const RANSOMWARE_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "rm1", prompt: "You receive an unexpected email with a Word document attached. When you open it, a yellow banner appears saying 'Macros have been disabled. Click Enable Content to view this document.' What do you do?",
    choices: [
      { id: "a", label: "Click Enable Content — the document won't display properly without it", correct: false, explanation: "Enabling macros in an unexpected document is the #1 ransomware delivery mechanism." },
      { id: "b", label: "Close the document and report it to IT without enabling content",       correct: true,  explanation: "Correct! The 'Enable Content' prompt on an unexpected document is a major red flag. Close it and report to IT." },
      { id: "c", label: "Enable Content but keep antivirus running in case",                     correct: false, explanation: "Antivirus cannot reliably detect all ransomware payloads. Once macros run, malicious code executes immediately." },
      { id: "d", label: "Save the document, close it, and open it again later",                 correct: false, explanation: "The risk remains regardless of when you open it. Report to IT, don't open it later." },
    ],
  },
  {
    id: "rm2", prompt: "Your screen suddenly shows a message saying all your files have been encrypted and demanding Bitcoin payment within 72 hours. What is your FIRST action?",
    choices: [
      { id: "a", label: "Pay the ransom immediately to recover files before the deadline",       correct: false, explanation: "Never pay the ransom. It does not guarantee file recovery and funds further attacks." },
      { id: "b", label: "Restart the computer to interrupt the encryption process",             correct: false, explanation: "Restarting does not stop encryption and destroys forensic evidence IT needs." },
      { id: "c", label: "Immediately disconnect from the network (unplug Ethernet, turn off WiFi) and call IT", correct: true, explanation: "Correct! Disconnecting stops ransomware from spreading to shared drives. Do not shut down. Call IT — do not email." },
      { id: "d", label: "Try to delete the ransomware files yourself using file explorer",      correct: false, explanation: "Self-remediation can destroy evidence and trigger additional malicious payloads. IT incident response is the only correct path." },
    ],
  },
  {
    id: "rm3", prompt: "You find a USB drive in the company car park with a label that reads 'Salary Review 2024 — Confidential'. What do you do with it?",
    choices: [
      { id: "a", label: "Plug it into your computer to find out who it belongs to and return it", correct: false, explanation: "This is a baiting attack. Plugging in can execute malware automatically — no clicks required on some systems." },
      { id: "b", label: "Take it home to check it safely on your personal computer",             correct: false, explanation: "Your personal computer can also be infected and spread malware back to company systems." },
      { id: "c", label: "Hand it to IT security without plugging it in anywhere",               correct: true,  explanation: "Correct! IT security can analyse found storage devices in a sandboxed environment. The label is bait — never plug in any device you didn't provision yourself." },
      { id: "d", label: "Leave it where you found it — not your problem",                       correct: false, explanation: "Leaving it means the next person might plug it in. Hand it to IT for safe disposal." },
    ],
  },
];

const MOBILE_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "mr1", prompt: "You're working from a coffee shop and need to access the company CRM to pull a customer report. There's free WiFi available. What do you do?",
    choices: [
      { id: "a", label: "Connect to the coffee shop WiFi and access the CRM directly",  correct: false, explanation: "Unprotected public WiFi can be monitored or spoofed by attackers." },
      { id: "b", label: "Connect to company VPN first, then access the CRM",            correct: true,  explanation: "Correct! Always connect VPN before accessing any corporate systems on public or untrusted networks." },
      { id: "c", label: "Use incognito mode — it's more secure",                        correct: false, explanation: "Incognito mode only prevents local browser history. It does not encrypt network traffic." },
      { id: "d", label: "Use your mobile data instead of WiFi",                         correct: false, explanation: "Mobile data is safer than unknown WiFi, but the company VPN policy still applies." },
    ],
  },
  {
    id: "mr2", prompt: "You arrive at a hotel conference and see two WiFi networks: 'Hotel_Conference_Free' with no password and 'Hotel_Free_WiFi' requiring your room number. Which do you use?",
    choices: [
      { id: "a", label: "Hotel_Conference_Free — it's easier and no password needed",          correct: false, explanation: "Open WiFi networks are the easiest to spoof. Attackers commonly set up evil twins at conferences." },
      { id: "b", label: "Hotel_Free_WiFi with your room number",                               correct: false, explanation: "Hotel WiFi can also be insecure or compromised. Room number authentication provides minimal security." },
      { id: "c", label: "Neither — use your mobile data hotspot or the company VPN on either network", correct: true, explanation: "Correct! Neither hotel WiFi option is inherently trustworthy. Conferences are high-value targets for WiFi-based attacks." },
      { id: "d", label: "Both are fine — hotel WiFi is professionally managed",               correct: false, explanation: "Professional management does not guarantee security from rogue access points." },
    ],
  },
  {
    id: "mr3", prompt: "Your company laptop is stolen from your car while you had it in the boot (trunk). What do you do first?",
    choices: [
      { id: "a", label: "File a police report so you have a crime reference number",          correct: false, explanation: "Police reporting is necessary but not the most urgent step. While you file, the attacker may be accessing company data." },
      { id: "b", label: "Contact IT security immediately so they can remotely wipe the device", correct: true, explanation: "Correct! IT security must be notified immediately. They can remotely wipe the device before data is accessed. Every minute counts." },
      { id: "c", label: "Change your email password from your phone",                         correct: false, explanation: "Good step but doesn't address all accounts and data on the device, and doesn't trigger the remote wipe." },
      { id: "d", label: "Wait to see if it turns up before causing a fuss",                   correct: false, explanation: "Waiting allows time for data to be extracted. Company policy requires immediate reporting." },
    ],
  },
];

const INCIDENT_SCENARIOS: ScenarioQuestion[] = [
  {
    id: "ir1", prompt: "You clicked a link in an email before realising it looked suspicious. The page asked for your username and password — and you entered them before the page looked wrong. What do you do?",
    choices: [
      { id: "a", label: "Change your password and hope for the best — no need to involve anyone else",  correct: false, explanation: "Insufficient. IT security must be notified to investigate the attack and protect colleagues." },
      { id: "b", label: "Change your password immediately AND report the incident to IT security with details", correct: true, explanation: "Correct! Change credentials to limit damage, then report fully to IT. Include the email, the URL, and the time." },
      { id: "c", label: "Delete the email so nobody thinks you were careless",                           correct: false, explanation: "Deleting the email destroys evidence IT security needs to investigate the attack." },
      { id: "d", label: "Wait to see if anything suspicious happens before reporting",                   correct: false, explanation: "Attackers move fast. Within minutes they can create forwarding rules or initiate wire transfers." },
    ],
  },
  {
    id: "ir2", prompt: "You receive an alert from your antivirus software that it has quarantined a suspicious file on your computer. Your computer is still working normally. What should you do?",
    choices: [
      { id: "a", label: "Nothing — antivirus handled it automatically, so you're safe",        correct: false, explanation: "Quarantine means that file was isolated. It doesn't guarantee there are no other malicious files." },
      { id: "b", label: "Delete the quarantined file yourself to clean up",                    correct: false, explanation: "IT needs to analyse what it was and where it came from. Deleting removes critical evidence." },
      { id: "c", label: "Report it to IT security with details of the alert — even though the computer seems fine", correct: true, explanation: "Correct! Antivirus detections are security events that must be reported. IT needs to investigate the full scope." },
      { id: "d", label: "Restart the computer to complete the cleaning process",               correct: false, explanation: "Restarting doesn't guarantee cleaning and may destroy forensic data." },
    ],
  },
  {
    id: "ir3", prompt: "During a late-night work session you notice your Outlook email is sending messages you didn't write to your contacts. What do you do?",
    choices: [
      { id: "a", label: "Delete the sent messages and change your password",                   correct: false, explanation: "Your account is actively compromised right now. Deleting destroys evidence and doesn't stop the attacker." },
      { id: "b", label: "Disconnect from the network immediately and call IT security — this is an active incident", correct: true, explanation: "Correct! Disconnect to stop further damage, then call IT — not email since the email system is compromised." },
      { id: "c", label: "Log out of Outlook and go to bed — it can wait until morning",        correct: false, explanation: "An active account compromise is a critical incident. Every minute allows the attacker to send more phishing emails." },
      { id: "d", label: "Post on the company Slack to warn colleagues not to open emails from you", correct: false, explanation: "IT should alert colleagues through official channels. Your Slack account may also be compromised." },
    ],
  },
];

function PasswordMFASim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Password & MFA: Make the Right Call" icon={<Lock className="h-5 w-5 text-accent" />} scenarios={PASSWORD_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}
function SocialEngineeringSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Social Engineering: What Would You Do?" icon={<Shield className="h-5 w-5 text-accent" />} scenarios={SOCIAL_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}
function DataProtectionSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Data Protection: Make the Right Call" icon={<Database className="h-5 w-5 text-accent" />} scenarios={DATA_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}
function RansomwareSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Ransomware: Spot the Threat & Respond" icon={<FileWarning className="h-5 w-5 text-accent" />} scenarios={RANSOMWARE_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}
function MobileRemoteSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Mobile & Remote: Stay Secure Anywhere" icon={<Wifi className="h-5 w-5 text-accent" />} scenarios={MOBILE_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}
function IncidentResponseSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  return <ScenarioSim title="Incident Response: What Do You Do?" icon={<AlertTriangle className="h-5 w-5 text-accent" />} scenarios={INCIDENT_SCENARIOS} onComplete={onComplete} onPrev={onPrev} />;
}

// ─── SIMULATION 4: Safe Browsing ──────────────────────────────────────────────

interface UrlItem { url: string; displayText: string; isSafe: boolean; explanation: string }

const URL_SCENARIOS: UrlItem[] = [
  { url: "https://accounts.google.com/signin", displayText: "https://accounts.google.com/signin", isSafe: true,
    explanation: "Safe. Read URLs right to left from the last dot before the path — the domain is google.com. This is the legitimate Google sign-in page." },
  { url: "https://google.accounts.com.phishsite.ru/signin", displayText: "https://google.accounts.com.phishsite.ru/signin", isSafe: false,
    explanation: "Dangerous! The real domain here is phishsite.ru — everything before that is just a subdomain path. 'google.accounts.com' is not the domain, it's the subdomain of phishsite.ru." },
  { url: "https://secure.paypal.com/login", displayText: "https://secure.paypal.com/login", isSafe: true,
    explanation: "Safe. The domain is paypal.com and 'secure' is just a legitimate subdomain. PayPal uses this URL for their login page." },
  { url: "https://paypal-secure-verify.com/login", displayText: "https://paypal-secure-verify.com/login", isSafe: false,
    explanation: "Dangerous! The domain is paypal-secure-verify.com — not paypal.com. Attackers add 'paypal' as a word in a fake domain to look legitimate." },
  { url: "https://companynamehere.sharepoint.com/sites/intranet", displayText: "https://companynamehere.sharepoint.com/sites/intranet", isSafe: true,
    explanation: "Safe. Microsoft SharePoint sites legitimately use the sharepoint.com domain. Your company's tenant is a subdomain of sharepoint.com." },
  { url: "https://sharepoint-company-docs.com/signin", displayText: "https://sharepoint-company-docs.com/signin", isSafe: false,
    explanation: "Dangerous! The domain is sharepoint-company-docs.com — not sharepoint.com or microsoft.com. Microsoft never uses external domains for SharePoint access." },
];

function SafeBrowsingSim({ onComplete, onPrev }: { onComplete: () => void; onPrev: () => void }) {
  const [choices, setChoices]   = useState<Record<number, "safe" | "dangerous">>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const allAnswered = URL_SCENARIOS.every((_, i) => choices[i] !== undefined);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Globe className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-xl font-heading font-semibold text-text-primary">Safe vs Dangerous URLs</h2>
          <p className="text-text-secondary text-sm">Classify each URL as safe or dangerous based on what you can see in the address bar.</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {URL_SCENARIOS.map((item, i) => {
          const choice     = choices[i];
          const isRevealed = revealed.has(i);
          const isCorrect  = choice === (item.isSafe ? "safe" : "dangerous");

          return (
            <div key={i} className={cn(
              "rounded-card border p-4 transition-colors",
              isRevealed ? (isCorrect ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5") : "border-border bg-elevated"
            )}>
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                <Globe className="h-4 w-4 text-text-muted flex-shrink-0" />
                <code className="text-xs text-text-primary font-mono whitespace-nowrap">{item.displayText}</code>
              </div>

              {!choice ? (
                <div className="flex gap-2">
                  <button onClick={() => { setChoices((p) => ({ ...p, [i]: "safe" })); setRevealed((p) => new Set([...p, i])); }}
                    className="flex-1 rounded-lg border border-success/40 bg-success/10 text-success text-sm py-2 hover:bg-success/20 transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Safe
                  </button>
                  <button onClick={() => { setChoices((p) => ({ ...p, [i]: "dangerous" })); setRevealed((p) => new Set([...p, i])); }}
                    className="flex-1 rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm py-2 hover:bg-danger/20 transition-colors flex items-center justify-center gap-2">
                    <XCircle className="h-4 w-4" /> Dangerous
                  </button>
                </div>
              ) : (
                <div className={cn("text-sm", isCorrect ? "text-success" : "text-danger")}>
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    {isCorrect ? <><CheckCircle2 className="h-4 w-4" /> Correct</> : <><XCircle className="h-4 w-4" /> Incorrect</>}
                  </p>
                  <p className="text-text-secondary text-xs leading-relaxed">{item.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
        <Button onClick={onComplete} className="flex-1 gap-2" disabled={!allAnswered}>
          {allAnswered ? "Proceed to Quiz" : `Classify all ${URL_SCENARIOS.length} URLs to continue`}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step: ASSESS ─────────────────────────────────────────────────────────────

function AssessStep({ questions, answers, submitted, score, passed, submitting, onAnswer, onSubmit, onRetry, onPrev }: {
  questions: Question[]; answers: Record<string, string>; submitted: boolean; score: number | null;
  passed: boolean; submitting: boolean;
  onAnswer: (qId: string, optId: string) => void; onSubmit: () => void; onRetry: () => void; onPrev: () => void;
}) {
  const answeredCount = Object.keys(answers).length;
  const allAnswered   = answeredCount === questions.length;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-text-primary mb-1">Knowledge Quiz</h2>
        <p className="text-text-secondary text-sm">{answeredCount} of {questions.length} answered</p>
      </div>

      {submitted && score !== null && (
        <div className={cn("rounded-card border p-4 mb-6 flex items-center gap-3",
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
                  const isCorrect  = submitted && opt.id === q.correctOptionId;
                  const isWrong    = submitted && isSelected && opt.id !== q.correctOptionId;
                  return (
                    <button key={opt.id} onClick={() => onAnswer(q.id, opt.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors",
                        isCorrect  ? "border-success bg-success/10 text-success" :
                        isWrong    ? "border-danger bg-danger/10 text-danger" :
                        isSelected ? "border-accent bg-accent/10 text-accent" :
                                     "border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                      )}
                    >{opt.text}</button>
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
            <Button variant="outline" onClick={onPrev} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={onSubmit} className="flex-1" disabled={!allAnswered || submitting}>
              {submitting ? "Submitting…" : `Submit Quiz (${answeredCount}/${questions.length})`}
            </Button>
          </>
        ) : !passed ? (
          <Button onClick={onRetry} variant="outline" className="flex-1 gap-2">Try Again</Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Step: CERTIFICATE ────────────────────────────────────────────────────────

function CertificateStep({ courseTitle, passed, isPreview, onHome }: {
  courseTitle: string; passed: boolean; isPreview?: boolean; onHome: () => void;
}) {
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
          ? isPreview
            ? `Preview complete for "${courseTitle}". In a real session this certificate would be issued.`
            : `You've successfully completed "${courseTitle}". Your certificate has been issued.`
          : `You're making progress on "${courseTitle}". Keep going!`}
      </p>

      {passed && !isPreview && (
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

      {isPreview && (
        <div className="card border-border bg-elevated p-5 mb-8 text-left">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-accent">Preview mode:</span> No certificate or completion record was saved.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={onHome} variant="outline" className="flex-1">Back to Dashboard</Button>
        {passed && !isPreview && (
          <Button onClick={() => window.location.href = "/employee/certificates"} className="flex-1 gap-2">
            <Trophy className="h-4 w-4" /> View Certificates
          </Button>
        )}
      </div>
    </div>
  );
}
