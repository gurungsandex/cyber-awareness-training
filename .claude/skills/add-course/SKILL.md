---
name: add-course
description: Author a new training course as an idempotent seed block — course record, modules, lessons in the supported mini-markdown, assessment with questions, and compliance/track metadata — in the exact CyberShield house format. Use when asked to add, write, or expand training content (courses, lessons, quizzes).
---

# Author a CyberShield course

Courses are **seed content**, not admin-UI input: they live in `cybershield/prisma/seed.ts` (~2,000
lines of prior art — always open an existing course block first and match it). The renderer is
`renderContent()` in `src/app/employee/courses/[courseId]/SimulationEngine.tsx`; it supports a small
fixed dialect, so content that "looks like markdown" but isn't in the dialect renders as plain text.

## Step 1 — Course plan (state it before writing)

Decide and record: slug (`course-<topic>`, e.g. `course-vendor-fraud`), title, one-sentence
description, `track` (one of `SECURITY_AWARENESS | PHISHING_DEFENSE | DATA_PRIVACY |
INCIDENT_RESPONSE | COMPLIANCE | LEADERSHIP`), `complianceFrameworks` (from the
`ComplianceFramework` enum in `prisma/schema.prisma`), `isMandatory`, `passMark` (default 80),
`estimatedMin` (sum of lesson `durationMin`, roughly), and whether it recurs
(`isRecurring` + `recurringIntervalMonths`).

Shape guideline from existing courses: 2–3 modules, 2–4 lessons each, 5–8 assessment questions.

## Step 2 — ID scheme (this is what makes re-seeding safe)

Every record gets a **stable, human-readable string id**. Follow the existing scheme exactly:

| Record | Pattern | Example |
|---|---|---|
| Course | `course-<topic>` | `course-vendor-fraud` |
| Module | `mod-<abbrev>-<n>` | `mod-vf-1` |
| Lesson | `les-<abbrev>-<module>-<lesson>` | `les-vf-1-2` |
| Assessment | `assess-<abbrev>` | `assess-vf` |
| Question | `q-<abbrev>-<n>` | `q-vf-3` |
| Option (inside question JSON) | `a`/`b`/`c`/`d` | `"id": "b"` |

Never use random or omitted ids in seed code — the whole file is upsert-keyed on these.

## Step 3 — The seed block

Append in the `COURSES` section of `main()`, using the existing helpers (`upsertCourse`,
`upsertModule`, `upsertLesson`, `upsertAssessment`, `upsertQuestions`) — do not hand-roll upserts:

```ts
// ── Course N: Vendor Fraud ──────────────────────────────────────────────────
await upsertCourse("course-vendor-fraud", {
  title: "Vendor Fraud & Invoice Scams",
  description: "Recognize business email compromise, fake invoices, and payment-diversion scams.",
  isMandatory: false,
  passMark: 80,
  estimatedMin: 20,
  complianceFrameworks: ["GENERAL", "SOC2"],
  track: "SECURITY_AWARENESS",
});

const modVf1 = await upsertModule("mod-vf-1", "course-vendor-fraud", "How Payment Scams Work", 0);
await upsertLesson("les-vf-1-1", modVf1.id, 0, "The Anatomy of an Invoice Scam", `# ...content...`, 6);
// ...more lessons/modules...

await upsertAssessment("assess-vf", "course-vendor-fraud", "Vendor Fraud Assessment", 80);
await upsertQuestions("assess-vf", [
  {
    id: "q-vf-1",
    text: "A long-time vendor emails new bank details for their next payment. What do you do first?",
    options: [
      { id: "a", text: "Update the payment details — it's a known vendor" },
      { id: "b", text: "Call the vendor on a previously known phone number to verify" },
      { id: "c", text: "Reply to the email asking them to confirm" },
      { id: "d", text: "Forward it to a colleague to handle" },
    ],
    correctOptionId: "b",
    explanation:
      "Bank-detail changes are the classic payment-diversion move. Verify out-of-band using contact details you already have — never the ones in the email.",
    orderIndex: 0,
  },
  // ...
]);
console.log("✅ Course: Vendor Fraud");
```

If the course should exist for the demo users, also add enrollments/notifications the way existing
seed sections do (upsert on `userId_courseId`). If asked to make it mandatory remediation content,
note that the remediation worker picks the **oldest mandatory published course** — adding a second
mandatory course can change remediation behavior; flag that.

## Step 4 — Lesson content dialect (the renderer's actual grammar)

Blocks are separated by **blank lines**. Supported blocks, and nothing else:

- `# Title` — one per lesson, first block.
- `## 1. Section Name. Body text...` — accent section header; everything after the first `.`/`?`/`!`
  followed by a capital becomes the body paragraph. Numbering in the name is conventional (`## 1.`,
  `## 2.`).
- `### Subheading` — plain small heading.
- Plain paragraph — supports `**bold**` inline only (no italics, links, or code).
- `- item` lines (each on its own line, one blank line before the block) — bulleted list.
- `1. item` lines — numbered list with styled counters.
- `**Label:** – item one – item two` — labelled list (en-dash `–` or hyphen separators).
- A standalone `**entire block bolded**` — renders as an accent callout box; use for the one key
  takeaway per lesson.
- Simple pipe table with a `|---|---|` separator row — keep to 2–4 columns.

**Not supported (renders as literal text):** links, images, code fences, blockquotes, nested lists,
`*italic*`, headings deeper than `###`. Do not use them.

Content quality bar per lesson: 150–400 words; concrete attacker examples with lookalike domains
written like `paypa1-secure.com`; one callout takeaway; `durationMin` between 4 and 10.

Question quality bar: exactly 4 options; one defensibly correct answer; distractors are *plausible
wrong behaviors* (not jokes); `explanation` teaches the rule in 1–3 sentences and never just restates
the correct option; `orderIndex` sequential from 0.

## Step 5 — Verify

```bash
cd cybershield
npx tsc --noEmit
npx prisma db seed && npx prisma db seed   # twice; second run must be clean (idempotency)
```

Then render it: log in as `alice.chen@cybershield.local` / `Employee!2026`, self-enrol via
`/employee/catalog` (or seed an enrollment), open the course, and click through **every lesson**
checking for blocks that rendered as raw markdown — that's the most common authoring failure. Take
the assessment, deliberately fail once (confirm remediation notification appears if mandatory
courses exist), then pass and confirm the score screen. Commit as
`Feature: <course title> course content (modules, lessons, assessment)`.
