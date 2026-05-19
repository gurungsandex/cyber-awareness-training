import {
  PrismaClient,
  Role,
  SimulationType,
  SimulationDifficulty,
  CourseStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertCourse(
  id: string,
  data: {
    title: string;
    description: string;
    isMandatory?: boolean;
    passMark?: number;
    estimatedMin?: number;
    complianceFrameworks?: import("@prisma/client").ComplianceFramework[];
    track?: import("@prisma/client").CourseTrack;
    isRecurring?: boolean;
    recurringIntervalMonths?: number;
  }
) {
  const { complianceFrameworks, track, isRecurring, recurringIntervalMonths, ...rest } = data;
  return db.course.upsert({
    where: { id },
    update: {
      ...(complianceFrameworks !== undefined && { complianceFrameworks }),
      ...(track !== undefined && { track }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurringIntervalMonths !== undefined && { recurringIntervalMonths }),
    },
    create: {
      id,
      status: CourseStatus.PUBLISHED,
      ...(complianceFrameworks !== undefined && { complianceFrameworks }),
      ...(track !== undefined && { track }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurringIntervalMonths !== undefined && { recurringIntervalMonths }),
      ...rest,
    },
  });
}

async function upsertModule(id: string, courseId: string, title: string, orderIndex: number) {
  return db.module.upsert({
    where: { id },
    update: {},
    create: { id, courseId, title, orderIndex },
  });
}

async function upsertLesson(
  id: string,
  moduleId: string,
  orderIndex: number,
  title: string,
  content: string,
  durationMin = 5
) {
  return db.lesson.upsert({
    where: { id },
    update: {},
    create: { id, moduleId, title, content, orderIndex, durationMin },
  });
}

async function upsertAssessment(id: string, courseId: string, title: string, passMark = 80) {
  return db.assessment.upsert({
    where: { id },
    update: {},
    create: { id, courseId, title, passMark, shuffleQs: true },
  });
}

async function upsertQuestions(
  assessmentId: string,
  questions: Array<{
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
    correctOptionId: string;
    explanation: string;
    orderIndex: number;
  }>
) {
  for (const q of questions) {
    await db.assessmentQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        assessmentId,
        text: q.text,
        options: q.options,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
        orderIndex: q.orderIndex,
      },
    });
  }
}

async function upsertTemplate(
  id: string,
  data: {
    name: string;
    type: SimulationType;
    difficulty: SimulationDifficulty;
    attackTactic: string;
    payload: object;
    redFlags: string[];
  }
) {
  return db.simulationTemplate.upsert({
    where: { id },
    update: {},
    create: { id, ...data },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding CyberShield...\n");

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: "cybershield-demo" },
    update: { registrationToken: "dev-registration-token-cybershield-2026" },
    create: {
      slug: "cybershield-demo",
      name: "CyberShield Demo",
      primaryColor: "#2D6A4F",
      registrationToken: "dev-registration-token-cybershield-2026",
    },
  });
  console.log("✅ Tenant");

  // ── Departments ─────────────────────────────────────────────────────────────
  // Migrate legacy departments that were created without a tenantId.
  // First delete null-tenantId rows that already have a tenant-scoped copy (avoids unique-constraint conflict).
  const tenantDeptNames = (await db.department.findMany({ where: { tenantId: tenant.id }, select: { name: true } }))
    .map((d) => d.name);
  await db.department.deleteMany({ where: { tenantId: null, name: { in: tenantDeptNames } } });
  // Adopt any remaining unscoped departments into this tenant.
  await db.department.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });

  async function upsertDept(name: string, description: string) {
    const existing = await db.department.findFirst({ where: { name, tenantId: tenant.id } });
    if (existing) return existing;
    return db.department.create({ data: { name, description, tenantId: tenant.id } });
  }
  const [it, finance, hr, sales, legal] = await Promise.all([
    upsertDept("IT",      "Information Technology"),
    upsertDept("Finance", "Finance & Accounting"),
    upsertDept("HR",      "Human Resources"),
    upsertDept("Sales",   "Sales & Marketing"),
    upsertDept("Legal",   "Legal & Compliance"),
  ]);
  console.log("✅ Departments");

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026", 12);
  const mgrHash = await bcrypt.hash("Manager!2026", 12);
  const empHash = await bcrypt.hash("Employee!2026", 12);

  await db.user.upsert({
    where: { email: "admin@cybershield.local" },
    update: {},
    create: { email: "admin@cybershield.local", name: "Platform Admin", passwordHash: adminHash, role: Role.ADMIN, tenantId: tenant.id },
  });
  await db.user.upsert({
    where: { email: "manager@cybershield.local" },
    update: {},
    create: { email: "manager@cybershield.local", name: "Jane Manager", passwordHash: mgrHash, role: Role.MANAGER, departmentId: it.id, tenantId: tenant.id },
  });

  const employees: [string, string, string][] = [
    ["Alice Chen",   "alice.chen@cybershield.local",   it.id],
    ["Bob Smith",    "bob.smith@cybershield.local",     finance.id],
    ["Carol Jones",  "carol.jones@cybershield.local",   hr.id],
    ["David Patel",  "david.patel@cybershield.local",   sales.id],
    ["Eve Müller",   "eve.muller@cybershield.local",    it.id],
    ["Frank Torres", "frank.torres@cybershield.local",  finance.id],
    ["Grace Kim",    "grace.kim@cybershield.local",     legal.id],
    ["Henry Osei",   "henry.osei@cybershield.local",    sales.id],
  ];

  for (const [name, email, deptId] of employees) {
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: empHash, role: Role.EMPLOYEE, departmentId: deptId, tenantId: tenant.id },
    });
  }
  console.log("✅ Users");

  // ════════════════════════════════════════════════════════════════════════════
  //  COURSES
  // ════════════════════════════════════════════════════════════════════════════

  // ── Course 1: Phishing 101 ──────────────────────────────────────────────────
  await upsertCourse("course-phishing-101", {
    title: "Phishing 101: Spot the Bait",
    description: "Learn to identify phishing emails, SMS scams, and credential-harvesting pages before they fool you.",
    isMandatory: true,
    passMark: 80,
    estimatedMin: 25,
    complianceFrameworks: ["GENERAL", "NIST_CSF", "CIS_CONTROLS", "SOC2"],
    track: "PHISHING_DEFENSE",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const mod1_1 = await upsertModule("mod-ph-1", "course-phishing-101", "The Anatomy of a Phish", 0);
  await upsertLesson("les-ph-1-1", mod1_1.id, 0, "Red Flags You Can Train Yourself to See", `# Red Flags in Phishing Emails

Phishing emails are designed to look legitimate, but they nearly always contain tells. Train your eye to spot these:

## 1. Mismatched Sender Domain
The display name might say "PayPal Support" but the actual email address is **support@paypa1-secure.com** — notice the "1" instead of "l" and the extra domain. Always hover over or click the sender address to verify.

## 2. Urgency and Fear
Phrases like *"Your account will be suspended in 24 hours"* or *"Immediate action required"* are designed to bypass rational thinking. Legitimate companies rarely demand immediate action via email.

## 3. Generic Greetings
"Dear Customer" or "Dear User" — real companies that hold your account know your name.

## 4. Suspicious Links
Hover before you click. The visible link text might say **secure.bank.com** but the actual URL is **bank-secure-login.phishsite.ru**.

## 5. Unexpected Attachments
An invoice you didn't request, a "delivery notification" PDF, or a Word doc that asks you to "enable macros" — these are classic delivery vehicles for malware.

## 6. Poor Grammar or Unusual Tone
Though sophisticated attacks are well-written, many phishes still contain awkward phrasing, spelling errors, or an oddly formal tone for a casual brand.`, 8);

  await upsertLesson("les-ph-1-2", mod1_1.id, 1, "The Lifecycle of a Phishing Attack", `# How Attackers Build and Launch Phishing Campaigns

Understanding the attacker's playbook helps you stay a step ahead.

## Step 1: Reconnaissance
Attackers harvest names, job titles, email addresses, and org charts from LinkedIn, company websites, and data-breach dumps. The more they know, the more convincing the lure.

## Step 2: Lure Crafting
They clone a trusted brand (Microsoft, your bank, your own IT department) and craft an email that fits a plausible scenario — password reset, invoice approval, benefits enrollment.

## Step 3: Infrastructure Setup
A look-alike domain is registered (e.g., **microsoft-support[.]net**). A credential-harvesting page is deployed that captures usernames and passwords before silently redirecting to the real site.

## Step 4: Delivery
The email is blasted out or targeted (spear-phishing). Some attackers use compromised legitimate email accounts to bypass spam filters.

## Step 5: Exploitation
A victim clicks. Credentials are stolen, malware is installed, or a fraudulent wire transfer is initiated — all within seconds.

## Your Defence
Report suspicious emails using your company's "Report Phishing" button. Even if you're 80% sure it's fine — report it. Your security team would rather investigate 10 false positives than miss one real attack.`, 7);

  const mod1_2 = await upsertModule("mod-ph-2", "course-phishing-101", "Spear Phishing & Business Email Compromise", 1);
  await upsertLesson("les-ph-2-1", mod1_2.id, 0, "When Attackers Do Their Homework", `# Spear Phishing: Targeted Attacks

## What Makes Spear Phishing Different?
Mass phishing sends millions of generic emails hoping a small percentage bite. **Spear phishing** targets a specific person or organisation using personalised information.

### Real example scenario:
> "Hi Sarah, this is Mark from Finance. I saw on LinkedIn you just joined as the new AP manager. Could you process this invoice (attached) as urgent? The vendor's been chasing us. — Mark"

There's no Mark. The invoice contains a macro-laden Word document.

## Business Email Compromise (BEC)
BEC is spear phishing's most financially devastating form. Attackers either:
- **Impersonate** a CEO, CFO, or trusted vendor via a lookalike email address
- **Compromise** a real executive's email account and send from it

**Common BEC scenarios:**
- CEO instructs finance to wire funds to a new account
- "Vendor" sends updated banking details for invoice payments
- HR is asked to re-route an employee's payroll

**BEC losses globally: $50+ billion** (FBI IC3, 2023)

## How to Verify
1. Call the sender directly using a number you look up yourself — not one from the email
2. Use your company's internal communication channel to confirm the request
3. Follow your financial approval procedures — they exist for exactly this reason`, 9);

  await upsertLesson("les-ph-2-2", mod1_2.id, 1, "Smishing, Vishing & Multi-Channel Attacks", `# Beyond Email: SMS & Voice Phishing

## Smishing (SMS Phishing)
Text messages carry an implicit trust — your phone number is harder to spoof and messages feel personal. Attackers exploit this:

**Common smishing lures:**
- "Your parcel is on hold. Pay £1.99 clearance fee: [link]"
- "URGENT: Unusual sign-in detected on your account. Verify: [link]"
- "Your bank has frozen your account. Call 0800-XXX-XXXX immediately."

**Rules:**
- Never click links in unexpected texts
- Banks and couriers will never ask you to enter card details via SMS link
- Call the organisation directly using their official number

## Vishing (Voice Phishing)
Callers impersonate IT support, bank fraud teams, HMRC/IRS, or Microsoft support.

**Classic script:** "Hello, I'm calling from your IT department. We've detected unusual activity on your account and need to verify your identity. Can you confirm your username and password?"

**Your IT department will NEVER ask for your password by phone.**

## Multi-Channel Attacks
Sophisticated attackers combine channels: an email primes you, then a follow-up "from the same person" arrives by text or phone call to add legitimacy. Don't let multiple contact attempts increase your trust — it's a social engineering technique.`, 6);

  const asm1 = await upsertAssessment("asm-phishing-101", "course-phishing-101", "Phishing 101 Assessment", 80);
  await upsertQuestions("asm-phishing-101", [
    {
      id: "q-ph-1", orderIndex: 0,
      text: "You receive an email from 'paypal-support@paypa1-secure.net' asking you to verify your account. What is the most suspicious indicator?",
      options: [{ id: "a", text: "The email uses the PayPal logo" }, { id: "b", text: "The sender domain is misspelled (paypa1 instead of paypal)" }, { id: "c", text: "The email was sent during business hours" }, { id: "d", text: "The email has a blue colour scheme" }],
      correctOptionId: "b",
      explanation: "The sender domain 'paypa1-secure.net' uses a '1' instead of 'l' in paypal — a classic lookalike domain technique. Always verify the full sender address, not just the display name.",
    },
    {
      id: "q-ph-2", orderIndex: 1,
      text: "An email from your 'CEO' asks you to urgently wire £50,000 to a new supplier — bypassing the normal approval process. What should you do?",
      options: [{ id: "a", text: "Wire the money immediately since it's from the CEO" }, { id: "b", text: "Reply to the email asking for more details" }, { id: "c", text: "Verify the request by calling the CEO directly on a known number" }, { id: "d", text: "Forward the email to a colleague to decide" }],
      correctOptionId: "c",
      explanation: "This is a Business Email Compromise (BEC) scenario. Always verify unusual financial requests through a separate communication channel — call the requester on a number you look up yourself, not one from the suspicious email.",
    },
    {
      id: "q-ph-3", orderIndex: 2,
      text: "A text message says your parcel is on hold and asks you to click a link and pay a small customs fee. What is the safest action?",
      options: [{ id: "a", text: "Click the link and pay — it's only a small amount" }, { id: "b", text: "Ignore and delete the message" }, { id: "c", text: "Forward it to colleagues to see if they got the same message" }, { id: "d", text: "Visit the courier's official website directly to check your delivery status" }],
      correctOptionId: "d",
      explanation: "This is a classic smishing attack. Instead of clicking the link in the message, go directly to the courier's official website (e.g., royalmail.com, fedex.com) and track your parcel there. Legitimate delivery companies do not request payment via SMS links.",
    },
    {
      id: "q-ph-4", orderIndex: 3,
      text: "Someone calls claiming to be from IT support and asks for your password to 'fix your account'. What do you do?",
      options: [{ id: "a", text: "Provide the password — IT needs it to help you" }, { id: "b", text: "Give a temporary password you make up" }, { id: "c", text: "Refuse — legitimate IT staff never need your password" }, { id: "d", text: "Ask them to email you first" }],
      correctOptionId: "c",
      explanation: "Legitimate IT staff never need to ask for your password. They have administrative access to reset accounts without knowing your credentials. This is a vishing (voice phishing) attack. Hang up and report it.",
    },
    {
      id: "q-ph-5", orderIndex: 4,
      text: "Before clicking a link in an email, what is the best quick check you can perform?",
      options: [{ id: "a", text: "Check if the email has your name in it" }, { id: "b", text: "Hover over the link to see the actual destination URL" }, { id: "c", text: "Check if the email has company branding" }, { id: "d", text: "Look at whether the email has an unsubscribe link" }],
      correctOptionId: "b",
      explanation: "Hovering over a link (without clicking) reveals the real destination URL in your browser's status bar or as a tooltip. If the displayed text says 'secure.bank.com' but the URL shows 'bank-verify.phishsite.ru', do not click it.",
    },
    {
      id: "q-ph-6", orderIndex: 5,
      text: "Which of the following is the BEST reason to report a phishing email even if you did NOT click anything?",
      options: [{ id: "a", text: "To get credit for spotting it" }, { id: "b", text: "Your security team can investigate and protect others who may also have received it" }, { id: "c", text: "So your inbox is kept clean" }, { id: "d", text: "It's a legal requirement" }],
      correctOptionId: "b",
      explanation: "Reporting a phishing email — even one you didn't interact with — allows your security team to investigate the attack, block the sender domain, warn other employees, and gather threat intelligence. One report can protect hundreds of colleagues.",
    },
  ]);

  // ── Course 2: Password Security & MFA ──────────────────────────────────────
  await upsertCourse("course-password-mfa", {
    title: "Password Security & Multi-Factor Authentication",
    description: "Master the art of strong passwords, password managers, and MFA to lock attackers out of your accounts.",
    isMandatory: true,
    passMark: 80,
    estimatedMin: 20,
    complianceFrameworks: ["GENERAL", "NIST_CSF", "SOC2", "ISO_27001"],
    track: "SECURITY_AWARENESS",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const mod2_1 = await upsertModule("mod-pw-1", "course-password-mfa", "The Problem with Passwords", 0);
  await upsertLesson("les-pw-1-1", mod2_1.id, 0, "Why Weak Passwords Are a Crisis", `# The Password Problem

## Scale of the Problem
**Over 24 billion username/password combinations** were circulating on criminal marketplaces in 2022 alone (Digital Shadows). Your credentials from a breach five years ago may still be actively used in attacks today.

## How Attackers Crack Passwords

### Brute Force
Automated tools try every possible combination. An 8-character lowercase password has 208 billion combinations — sounds huge, but modern hardware can test **10 billion guesses per second**.

- 8 characters (lowercase only): cracked in **seconds**
- 8 characters (mixed case + numbers): cracked in **hours**
- 12 characters (mixed case + numbers + symbols): cracked in **centuries**

### Dictionary Attacks
Tools try common words, names, and known password patterns first. "Password1!", "Summer2024", "Company@123" are all in these dictionaries.

### Credential Stuffing
Attackers take breached username/password pairs and try them on other sites. If you use the same password on your work email as on a breached gaming site, your work account is compromised.

### The #1 Lesson
**Every account must have a unique password.** Reuse is how one breach becomes ten breaches.`, 7);

  await upsertLesson("les-pw-1-2", mod2_1.id, 1, "What Makes a Password Strong", `# Building Uncrackable Passwords

## Length Is King
Password strength grows exponentially with length. A 16-character passphrase of random words is astronomically harder to crack than an 8-character "complex" password.

**Bad:** P@ssw0rd! (8 chars, common pattern)
**Good:** correct-horse-battery-staple (28 chars, four random words)
**Better:** a random 20+ character string from your password manager

## Passphrases
Combine 4–5 random words. Easy to remember, hard to crack:
- **BlueTruckOceanPencil17** ✓
- **MarbleElephantSunset#Lamp** ✓

## What to Avoid
- Dictionary words alone: "sunshine"
- Predictable substitutions: "p@ssw0rd" (attackers know these)
- Personal information: birthdays, pet names, sports teams
- Keyboard walks: "qwerty", "123456", "zxcvbn"
- Company name + year: "Acme2024!"

## NIST Guidelines (2024)
The National Institute of Standards and Technology now recommends:
- **Minimum 8 characters** for user-created passwords, 15+ preferred
- **Don't force complexity rules** — they encourage weak predictable patterns
- **Allow all printable characters**
- **Check against known-breached password lists**
- **Remove mandatory periodic resets** unless compromise is suspected`, 6);

  const mod2_2 = await upsertModule("mod-pw-2", "course-password-mfa", "Password Managers & MFA", 1);
  await upsertLesson("les-pw-2-1", mod2_2.id, 0, "Password Managers: Your Security Superpower", `# Why Everyone Should Use a Password Manager

## The Math Problem
The average person has 100+ online accounts. You cannot memorise 100 unique, strong passwords. Without a password manager, you will reuse passwords — and reuse is how breaches cascade.

## How Password Managers Work
A password manager encrypts your passwords locally using a master password that only you know. Even the password manager company cannot see your passwords (zero-knowledge architecture).

**What they do:**
- Generate strong, unique, random passwords for every site
- Auto-fill credentials securely
- Alert you to breached or weak passwords
- Sync across devices
- Store secure notes, card details, identity info

## Choosing a Password Manager
**Recommended options:** Bitwarden (open source, free tier), 1Password, Dashlane, KeePassXC (offline)

**Green flags:** Zero-knowledge encryption, open-source or independently audited, MFA support, breach monitoring

**Red flags:** Stores your master password, no MFA option, no security audit history

## Getting Started
1. Choose a password manager
2. Set a strong, memorable master passphrase (this is the ONE password you memorise)
3. Enable MFA on the password manager itself
4. Import existing passwords and update weak/reused ones gradually`, 8);

  await upsertLesson("les-pw-2-2", mod2_2.id, 1, "Multi-Factor Authentication Explained", `# Multi-Factor Authentication (MFA)

## Why MFA Is Non-Negotiable
Even a strong, unique password can be stolen through phishing, keyloggers, or data breaches. MFA means **a stolen password alone is not enough** to access your account.

## The Three Factors
- **Something you know:** password, PIN
- **Something you have:** authenticator app, hardware key, SMS code
- **Something you are:** fingerprint, face ID

MFA requires at least two of these. Even if an attacker steals your password (something you know), they cannot log in without your phone (something you have).

## MFA Types — Ranked by Security

| Method | Security | Convenience |
|--------|----------|-------------|
| Hardware key (YubiKey) | ⭐⭐⭐⭐⭐ | Medium |
| Authenticator app (TOTP) | ⭐⭐⭐⭐ | Good |
| Push notification (Duo/Okta) | ⭐⭐⭐ | Excellent |
| SMS / voice code | ⭐⭐ | Good |
| Email code | ⭐ | Good |

## MFA Fatigue Attacks
Attackers who have your password can flood your phone with push notification requests hoping you'll approve one by accident or frustration. **Never approve an MFA prompt you didn't initiate.** Report it immediately — someone has your password.

## Enable MFA Today On
- Work email and Microsoft 365 / Google Workspace
- Password manager
- Banking and financial accounts
- Social media
- Any account containing sensitive data`, 9);

  const asm2 = await upsertAssessment("asm-password-mfa", "course-password-mfa", "Password & MFA Assessment", 80);
  await upsertQuestions("asm-password-mfa", [
    {
      id: "q-pw-1", orderIndex: 0,
      text: "Which password is the MOST secure?",
      options: [{ id: "a", text: "P@ssw0rd123!" }, { id: "b", text: "qwerty" }, { id: "c", text: "CorrectHorseBatteryStaple42#" }, { id: "d", text: "Summer2024" }],
      correctOptionId: "c",
      explanation: "Length matters most. 'CorrectHorseBatteryStaple42#' is 27 characters — it would take centuries to brute-force even without special characters. The other options are short, use predictable patterns, or are dictionary words.",
    },
    {
      id: "q-pw-2", orderIndex: 1,
      text: "You get 10 push notification MFA approval requests in 2 minutes that you did not initiate. What does this indicate?",
      options: [{ id: "a", text: "A system glitch — approve one to stop the notifications" }, { id: "b", text: "Someone with your password is running an MFA fatigue attack" }, { id: "c", text: "Your phone number has changed" }, { id: "d", text: "Your account is being upgraded" }],
      correctOptionId: "b",
      explanation: "This is an MFA fatigue attack. An attacker who already has your password is bombarding you with push requests hoping you'll approve one. Deny all, change your password immediately, and report it to your security team.",
    },
    {
      id: "q-pw-3", orderIndex: 2,
      text: "What is the primary security advantage of a password manager?",
      options: [{ id: "a", text: "It makes your passwords easier to type" }, { id: "b", text: "It allows you to use the same password everywhere securely" }, { id: "c", text: "It generates and stores unique strong passwords for every account" }, { id: "d", text: "It stores your passwords in the cloud for easy access" }],
      correctOptionId: "c",
      explanation: "Password managers generate unique, random, strong passwords for every account, solving the password reuse problem. They encrypt your passwords with a master key that only you control.",
    },
    {
      id: "q-pw-4", orderIndex: 3,
      text: "Which MFA method provides the HIGHEST security?",
      options: [{ id: "a", text: "SMS one-time code" }, { id: "b", text: "Email verification link" }, { id: "c", text: "Hardware security key (e.g., YubiKey)" }, { id: "d", text: "Security question" }],
      correctOptionId: "c",
      explanation: "Hardware security keys provide the strongest MFA. They use cryptographic proof-of-possession and are immune to phishing because they verify the real site domain. SMS codes can be intercepted via SIM-swapping; security questions are not true MFA.",
    },
    {
      id: "q-pw-5", orderIndex: 4,
      text: "Your company account uses the password 'Acme2024!' which you also use on three other sites. One of those sites is breached. What is the risk?",
      options: [{ id: "a", text: "None — each site is separate" }, { id: "b", text: "Attackers can use your credentials from the breach to access your work account (credential stuffing)" }, { id: "c", text: "Only the breached site is at risk" }, { id: "d", text: "The risk is low because your password has numbers and punctuation" }],
      correctOptionId: "b",
      explanation: "Credential stuffing uses breached username/password pairs to attack other services. If you reuse 'Acme2024!' across sites, attackers will try it on your work email, banking, and everywhere else. Every account needs a unique password.",
    },
  ]);

  // ── Course 3: Social Engineering Defense ───────────────────────────────────
  await upsertCourse("course-social-engineering", {
    title: "Social Engineering Defense",
    description: "Understand the psychological tricks attackers use to manipulate people into bypassing security — and how to defend against them.",
    isMandatory: false,
    passMark: 75,
    estimatedMin: 30,
    complianceFrameworks: ["GENERAL", "NIST_CSF", "SOC2"],
    track: "SECURITY_AWARENESS",
  });

  const mod3_1 = await upsertModule("mod-se-1", "course-social-engineering", "The Psychology of Manipulation", 0);
  await upsertLesson("les-se-1-1", mod3_1.id, 0, "Why Smart People Get Fooled", `# The Human Vulnerability

## Security's Weakest Link
Technology can be patched. Humans are harder to patch. Social engineering bypasses technical controls entirely by exploiting how we think and feel.

## Psychological Principles Attackers Exploit

### Authority
We're wired to follow authority figures. An attacker impersonating your CEO, your bank's fraud team, or a government agency triggers automatic compliance.

*"This is the CTO. I need those credentials now for an audit — don't go through normal channels, we're short on time."*

### Urgency & Scarcity
When we feel rushed, we skip verification steps. Attackers manufacture time pressure to prevent rational thinking.

*"Your account will be permanently deleted in 4 hours if you don't verify now."*

### Social Proof
"Everyone else is doing it" reduces our guard. Attackers may claim "other managers have already approved this" to make you feel safe following suit.

### Liking & Familiarity
We comply more readily with people we like or who seem familiar. Attackers study LinkedIn, Facebook, and company websites to craft messages that feel personal.

### Reciprocity
When someone does us a favour, we feel obligated to return it. An attacker who offers help first may leverage that goodwill for a request later.

### Fear
"Your computer has a virus." "You're under investigation." "Your account shows fraudulent activity." Fear shuts down critical thinking.`, 8);

  await upsertLesson("les-se-1-2", mod3_1.id, 1, "Common Attack Types", `# Social Engineering Attack Methods

## Pretexting
The attacker fabricates a scenario (the pretext) to establish trust before making a request. They may pose as:
- A new IT contractor who needs temporary access
- A vendor auditor needing to verify supplier data
- A journalist researching your company
- A new colleague who "hasn't got their badge yet"

**Defence:** Verify identity through official channels before granting access or sharing information.

## Tailgating / Piggybacking
Following an authorised person through a secure door without badging in. The attacker exploits politeness — we hold doors open for people carrying things or looking rushed.

**Defence:** Every person must badge in individually. Politely challenging someone at a secure door is not rude — it's policy.

## Baiting
Leaving infected USB drives in car parks, reception areas, or post them to employees labelled "Salary Data 2024" or "Redundancy List". Curiosity does the damage.

**Defence:** Never plug in a USB drive you didn't provision yourself. Report found drives to IT.

## Quid Pro Quo
"I'll fix your computer problem if you give me your login credentials" — typically over the phone posing as IT support.

**Defence:** IT will never ask for your password. Raise a proper ticket through official channels.

## Watering Hole
Attackers compromise a legitimate website your industry commonly visits, then infect visitors. Law firms, trade associations, and supplier portals are common targets.

**Defence:** Keep browsers and plugins patched. Use endpoint detection software. Be suspicious of unexpected download prompts on familiar sites.`, 8);

  const mod3_2 = await upsertModule("mod-se-2", "course-social-engineering", "Recognise & Respond", 1);
  await upsertLesson("les-se-2-1", mod3_2.id, 0, "Red Flags and Verification Techniques", `# Spotting and Stopping Social Engineering

## Universal Red Flags
Regardless of channel (phone, email, in-person), be suspicious when:

1. **Unverifiable identity** — they can't or won't prove who they are through official means
2. **Unusual request** — outside normal business processes, especially involving credentials, money, or sensitive data
3. **Pressure tactics** — urgency, deadlines, or emotional manipulation
4. **Bypassing procedures** — "skip the normal process just this once"
5. **Too much information** — attackers often over-explain to pre-empt questions
6. **Flattery or sympathy** — excessive praise or a sob story before a request

## The Pause Principle
When you feel pressure to act fast — **stop**. Legitimate business requests can wait for you to verify them. The urgency is part of the attack.

## Verification Steps
- **Phone calls:** Hang up. Find the official number through your internal directory or the company's website. Call back.
- **Emails:** Don't reply to the suspicious email. Contact the sender through a known-good channel.
- **In-person:** Ask for ID. Check with reception. Call their organisation directly.
- **Financial requests:** Always follow dual-authorisation processes. No CEO override, ever.

## It's OK to Say No
Company policy is your shield. "I need to follow our verification procedure" is a complete answer. Legitimate people understand. Attackers get angry — and that anger is itself a red flag.`, 7);

  const asm3 = await upsertAssessment("asm-social-eng", "course-social-engineering", "Social Engineering Defense Assessment", 75);
  await upsertQuestions("asm-social-eng", [
    {
      id: "q-se-1", orderIndex: 0,
      text: "Someone you don't recognise follows closely behind you through a badge-access door, smiling and carrying a box. What should you do?",
      options: [{ id: "a", text: "Hold the door open — it would be rude not to" }, { id: "b", text: "Politely ask them to badge in separately or direct them to reception" }, { id: "c", text: "Assume they're a contractor and let them through" }, { id: "d", text: "Nothing — it happens all the time" }],
      correctOptionId: "b",
      explanation: "This is tailgating. Every person must badge in separately. Asking someone to verify is company policy, not rudeness. Legitimate visitors will understand; attackers may become confrontational — which is itself a red flag.",
    },
    {
      id: "q-se-2", orderIndex: 1,
      text: "You find a USB drive labelled 'Q3 Salaries — Confidential' in the car park. What do you do?",
      options: [{ id: "a", text: "Plug it in to identify the owner so you can return it" }, { id: "b", text: "Take it home — it's not your problem" }, { id: "c", text: "Hand it to IT security without plugging it in" }, { id: "d", text: "Leave it where you found it" }],
      correctOptionId: "c",
      explanation: "This is a baiting attack. USB drives found in unexpected places are often pre-loaded with malware. The curiosity-inducing label is intentional. Hand it to IT security so they can analyse it safely.",
    },
    {
      id: "q-se-3", orderIndex: 2,
      text: "A caller says they're from IT and need your password to apply a 'critical security patch' before end of day. What do you do?",
      options: [{ id: "a", text: "Give it — security patches are important" }, { id: "b", text: "Ask for their employee ID then give the password" }, { id: "c", text: "Decline — IT never needs your password — and report the call" }, { id: "d", text: "Give a fake password to test if they're real" }],
      correctOptionId: "c",
      explanation: "Legitimate IT staff never need your password. This is a quid pro quo attack. Decline, hang up, and report the call to your security team so they can alert other employees.",
    },
    {
      id: "q-se-4", orderIndex: 4,
      text: "Which psychological principle does this message exploit? 'Act now — only 2 spots left in the compliance training or your certification will lapse!'",
      options: [{ id: "a", text: "Authority" }, { id: "b", text: "Social proof" }, { id: "c", text: "Scarcity and urgency" }, { id: "d", text: "Reciprocity" }],
      correctOptionId: "c",
      explanation: "Scarcity ('only 2 spots') and urgency ('act now', 'will lapse') are combined to pressure you into acting without verifying the request. Pause, check the message is from a legitimate source, and go through official channels.",
    },
    {
      id: "q-se-5", orderIndex: 5,
      text: "The best first response when you feel pressured to act immediately on an unusual request is to:",
      options: [{ id: "a", text: "Comply — speed shows you're a team player" }, { id: "b", text: "Pause and verify the request through an independent channel" }, { id: "c", text: "Ask the requester for more details by replying to the same email" }, { id: "d", text: "Escalate by forwarding the message to your whole team" }],
      correctOptionId: "b",
      explanation: "The Pause Principle: urgency is a manipulation technique. Pause, verify through an independent channel (not the one the attacker controls), and follow standard procedures. Replying to the suspicious email keeps you in the attacker's controlled channel.",
    },
  ]);

  // ── Course 4: Safe Browsing & Web Security ─────────────────────────────────
  await upsertCourse("course-safe-browsing", {
    title: "Safe Browsing & Web Security",
    description: "Navigate the web securely — spot malicious sites, understand HTTPS, manage downloads, and avoid browser-based attacks.",
    isMandatory: false,
    passMark: 75,
    estimatedMin: 20,
    complianceFrameworks: ["GENERAL", "CIS_CONTROLS"],
    track: "SECURITY_AWARENESS",
  });

  const mod4_1 = await upsertModule("mod-sb-1", "course-safe-browsing", "Recognising Dangerous Websites", 0);
  await upsertLesson("les-sb-1-1", mod4_1.id, 0, "HTTPS, Certificates & Lookalike Domains", `# Is This Website Safe?

## HTTPS Is Necessary but Not Sufficient
The padlock icon means the connection between your browser and the server is **encrypted in transit** — attackers on the network can't eavesdrop. It does NOT mean the site itself is trustworthy.

Phishing sites routinely use HTTPS. Never let the padlock alone convince you a site is legitimate.

## What to Actually Check
1. **The domain name** — Read it carefully from right to left after the last dot:
   - \`accounts.google.com\` → the domain is \`google.com\` ✓
   - \`google.accounts.com.phishingsite.ru\` → the domain is \`phishingsite.ru\` ✗

2. **Lookalike characters:** microsoft.com vs. mıcrosoft.com (IDN homograph attack using ı instead of i)

3. **Extra subdomains or hyphens:** paypal-secure-login.net, amazon-order-verify.com

4. **Unexpected TLD:** company.net instead of company.com

## Browser Safety Indicators
- 🔒 HTTPS padlock: encrypted transit (good baseline)
- Certificate info: click the padlock to see who the certificate was issued to
- 🚨 "Not Secure" or certificate error: do not proceed

## Safe URL Habits
- Type important URLs directly rather than clicking links
- Bookmark frequently used sites (banking, email, company portals)
- Use a browser with built-in phishing protection (Chrome, Firefox, Edge all have this)`, 7);

  await upsertLesson("les-sb-1-2", mod4_1.id, 1, "Drive-By Downloads & Malicious Ads", `# Web-Based Malware Delivery

## Drive-By Downloads
Malware can be downloaded and executed just by visiting a compromised website — no click required. These exploit vulnerabilities in browsers, browser plugins (Java, Flash), or the operating system itself.

**Defence:**
- Keep your browser and operating system updated — patches close exploit windows
- Remove unused browser extensions and plugins
- Use an ad blocker (malicious ads, "malvertising", are a common delivery method)
- Enable your browser's Enhanced Protection / Safe Browsing mode

## Malvertising
Attackers buy ad slots on legitimate ad networks to serve malware-laden ads on mainstream websites. Even trusted news sites can serve malicious ads through compromised ad networks.

**Defence:** Use an ad blocker. Ublock Origin is free, open-source, and highly effective.

## Fake Download Buttons
Search for "VLC download" and you may land on sites with giant "Download Now" buttons that are ads pointing to malware installers. The real download is a small link elsewhere.

**Defence:** Only download software from the developer's official website. Go directly — don't search.

## Browser Extension Risks
Extensions have broad access to your browsing data. Malicious extensions can steal passwords, inject ads, or harvest credentials.

**Rules:** Only install extensions from trusted publishers. Review permissions before installing. Remove extensions you no longer use.`, 6);

  const asm4 = await upsertAssessment("asm-safe-browsing", "course-safe-browsing", "Safe Browsing Assessment", 75);
  await upsertQuestions("asm-safe-browsing", [
    {
      id: "q-sb-1", orderIndex: 0,
      text: "A website has a padlock icon and uses HTTPS. Does this mean it is safe to enter your login credentials?",
      options: [{ id: "a", text: "Yes — HTTPS means the site is verified and safe" }, { id: "b", text: "No — HTTPS only means the connection is encrypted, not that the site is legitimate" }, { id: "c", text: "Yes — only legitimate companies can get HTTPS" }, { id: "d", text: "Only if the padlock is green" }],
      correctOptionId: "b",
      explanation: "HTTPS encrypts data in transit but does not verify the site is who it claims to be. Phishing sites routinely use HTTPS. Always verify the domain name carefully, not just the presence of HTTPS.",
    },
    {
      id: "q-sb-2", orderIndex: 1,
      text: "You visit a news website and a pop-up offers to scan your computer for viruses. What should you do?",
      options: [{ id: "a", text: "Run the scan — free security tools are helpful" }, { id: "b", text: "Close the pop-up and do not interact with it" }, { id: "c", text: "Download the scanner — it must be safe if the news site recommends it" }, { id: "d", text: "Click 'Not Now' to dismiss it safely" }],
      correctOptionId: "b",
      explanation: "Fake virus alerts from websites are a common social engineering tactic to trick users into downloading malware. Legitimate antivirus software does not operate through browser pop-ups. Close the tab entirely.",
    },
    {
      id: "q-sb-3", orderIndex: 2,
      text: "You need to download VLC media player. What is the safest approach?",
      options: [{ id: "a", text: "Search 'VLC download' and click the first result" }, { id: "b", text: "Click a 'Download VLC' ad that appears in search results" }, { id: "c", text: "Navigate directly to videolan.org (the official VLC website)" }, { id: "d", text: "Download it from any site with the VLC logo" }],
      correctOptionId: "c",
      explanation: "Only download software from the official developer's website. Search results and ads frequently lead to fake download sites that bundle malware. Navigate directly to the official URL.",
    },
  ]);

  // ── Course 5: Data Protection & Privacy ────────────────────────────────────
  await upsertCourse("course-data-protection", {
    title: "Data Protection & Privacy Fundamentals",
    description: "Understand your obligations around personal data, how to classify and handle sensitive information, and avoid costly compliance breaches.",
    isMandatory: true,
    passMark: 80,
    estimatedMin: 25,
    complianceFrameworks: ["GDPR", "HIPAA", "SOC2", "ISO_27001"],
    track: "DATA_PRIVACY",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const mod5_1 = await upsertModule("mod-dp-1", "course-data-protection", "Understanding Personal Data", 0);
  await upsertLesson("les-dp-1-1", mod5_1.id, 0, "What is Personal Data and Why Does It Matter", `# Personal Data: Your Responsibility

## What Counts as Personal Data?
Under GDPR and equivalent regulations, personal data is **any information that can identify a living individual** — directly or indirectly.

**Obviously personal data:**
- Name, address, date of birth
- Email address, phone number
- National insurance / social security number
- Passport / driving licence number

**Less obvious personal data:**
- IP addresses
- Cookie identifiers
- Location data
- Employee ID numbers (when linked to a person)
- Combination of age + postcode + employer (can identify someone)

**Special category data (highest sensitivity):**
- Health and medical data
- Racial or ethnic origin
- Religious beliefs
- Trade union membership
- Biometric data

## Why Should You Care?
**For individuals:** Privacy violations cause real harm — identity theft, discrimination, emotional distress.

**For the organisation:**
- GDPR fines: up to **4% of global annual turnover or €20 million**, whichever is higher
- Reputational damage
- Customer trust loss
- Regulatory investigations

**A single mishandled spreadsheet of customer records can trigger all of the above.**`, 8);

  await upsertLesson("les-dp-1-2", mod5_1.id, 1, "Data Classification and Handling Rules", `# Handling Data Correctly

## Data Classification Framework

| Level | Examples | Handling |
|-------|----------|----------|
| **Public** | Marketing materials, press releases | No restrictions |
| **Internal** | Internal memos, org charts | Don't share externally |
| **Confidential** | Customer records, contracts, financial data | Access-controlled, encrypted |
| **Restricted** | Health records, credentials, legal privilege | Strict need-to-know, encrypted at rest & in transit |

## The 10 Commandments of Data Handling

1. **Collect only what you need** (data minimisation)
2. **Use data only for the purpose collected** (purpose limitation)
3. **Don't keep it longer than necessary** (storage limitation)
4. **Secure it appropriately for its sensitivity**
5. **Never email unencrypted sensitive files** — use secure file-share platforms
6. **Lock your screen** when stepping away from your desk
7. **Clear your desk** — no sensitive documents left visible
8. **Shred paper documents** containing personal data
9. **Report data breaches immediately** — even suspected ones. You have 72 hours to notify the regulator
10. **Don't take personal data home** on unencrypted devices

## Subject Access Requests (SARs)
Individuals have the right to ask what data you hold about them. You must respond within **30 days**. If you receive a SAR, notify your Data Protection Officer (DPO) immediately.`, 7);

  const asm5 = await upsertAssessment("asm-data-protection", "course-data-protection", "Data Protection Assessment", 80);
  await upsertQuestions("asm-data-protection", [
    {
      id: "q-dp-1", orderIndex: 0,
      text: "Which of the following is considered 'special category' personal data under GDPR?",
      options: [{ id: "a", text: "A customer's email address" }, { id: "b", text: "An employee's job title" }, { id: "c", text: "A patient's medical diagnosis" }, { id: "d", text: "A company's registered address" }],
      correctOptionId: "c",
      explanation: "Health and medical data is special category data under GDPR Article 9, requiring the highest level of protection. Email addresses and job titles are personal data but not special category. A company address is not personal data.",
    },
    {
      id: "q-dp-2", orderIndex: 1,
      text: "You discover that a spreadsheet containing 500 customer records was accidentally emailed to the wrong address this morning. What is the first thing you should do?",
      options: [{ id: "a", text: "Wait to see if anyone complains before escalating" }, { id: "b", text: "Delete the sent email and hope nobody notices" }, { id: "c", text: "Report it to your manager and DPO immediately — the organisation has 72 hours to notify the regulator" }, { id: "d", text: "Send an apology email to the wrong recipient" }],
      correctOptionId: "c",
      explanation: "A personal data breach must be reported to your Data Protection Officer immediately. GDPR requires notifying the supervisory authority within 72 hours of becoming aware of the breach. Delays or cover-ups significantly worsen penalties.",
    },
    {
      id: "q-dp-3", orderIndex: 2,
      text: "A customer emails to ask what personal data you hold about them. This is called a Subject Access Request. How long do you have to respond?",
      options: [{ id: "a", text: "7 days" }, { id: "b", text: "30 days" }, { id: "c", text: "60 days" }, { id: "d", text: "90 days" }],
      correctOptionId: "b",
      explanation: "Under GDPR, you must respond to a Subject Access Request within 30 calendar days. Forward the request to your DPO immediately so the clock doesn't run out.",
    },
  ]);

  // ── Course 6: Ransomware Prevention ────────────────────────────────────────
  await upsertCourse("course-ransomware", {
    title: "Ransomware & Malware Prevention",
    description: "Understand how ransomware works, how it enters your organisation, and the critical behaviours that stop it spreading.",
    isMandatory: true,
    passMark: 80,
    estimatedMin: 22,
    complianceFrameworks: ["NIST_CSF", "CIS_CONTROLS", "SOC2", "ISO_27001"],
    track: "SECURITY_AWARENESS",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const mod6_1 = await upsertModule("mod-rm-1", "course-ransomware", "How Ransomware Works", 0);
  await upsertLesson("les-rm-1-1", mod6_1.id, 0, "The Ransomware Lifecycle", `# Ransomware: How a Single Click Can Cost Millions

## What Is Ransomware?
Ransomware is malware that encrypts your files — and often your entire organisation's files — then demands payment (ransom) for the decryption key.

**Average ransom demand:** $1.5 million (2023)
**Average total cost of a ransomware attack (including downtime, recovery):** $4.5 million
**Average downtime:** 24 days

## How Ransomware Gets In

### 1. Phishing Emails (Most Common — 41%)
A malicious attachment (Word doc, PDF, ZIP) or link that executes malware. The attachment often asks you to "enable macros" — which runs the malicious code.

### 2. Remote Desktop Protocol (RDP) Exploitation
Exposed RDP ports with weak passwords are scanned and brute-forced constantly. Once in, attackers have full control.

### 3. Software Vulnerabilities
Unpatched software — especially VPNs, firewalls, and email servers — are targeted within hours of a vulnerability being published.

### 4. Supply Chain
Attackers compromise a software vendor and push malicious updates to thousands of customers (e.g., SolarWinds, Kaseya).

## The Kill Chain
1. **Initial access** (phishing / exploit)
2. **Persistence** (malware installs itself to survive reboots)
3. **Lateral movement** (spreads across the network)
4. **Data exfiltration** (steals data before encrypting — for double extortion)
5. **Encryption** (files locked, ransom note dropped)
6. **Extortion** (ransom demand + threat to publish stolen data)

The average attacker is **dwell in your network for 16 days** before deploying the ransomware — scanning, stealing data, and escalating privileges.`, 9);

  await upsertLesson("les-rm-1-2", mod6_1.id, 1, "Prevention Behaviours That Stop Ransomware", `# Your Role in Stopping Ransomware

## The Good News
Most ransomware attacks are preventable. The majority enter via phishing or known vulnerabilities. Your behaviour directly impacts the risk.

## Critical Employee Behaviours

### 1. Never Enable Macros in Unexpected Documents
If a Word or Excel file you didn't request asks you to "Enable Content" or "Enable Macros" to view it — **do not click Enable**. This is the single most common ransomware delivery mechanism. Report the file to IT.

### 2. Don't Click Links or Open Attachments in Unexpected Emails
Refer to Phishing 101. When in doubt, verify with the sender through a separate channel.

### 3. Keep Software Updated
When your operating system or applications prompt you to update — do it. Patches close vulnerabilities attackers actively exploit. Don't defer indefinitely.

### 4. Use Company VPN When Working Remotely
VPN routes your traffic through secure company infrastructure, reducing exposure of your device to the internet.

### 5. Don't Use Personal USB Drives on Work Equipment
Malware can spread via USB. Only use IT-issued storage.

### 6. Back Up Critical Data
If ransomware encrypts your files, a clean backup is your recovery option. Use your company's approved backup solution (OneDrive, SharePoint, company NAS). Files stored only on your local desktop are at risk.

## If You Suspect Ransomware
1. **Disconnect from the network immediately** — unplug the Ethernet cable, turn off Wi-Fi
2. **Do NOT shut down the computer** — forensic evidence may be needed
3. **Call IT immediately** — do not email (email server may be compromised)
4. **Do not pay the ransom** — it does not guarantee recovery and funds further attacks`, 8);

  const asm6 = await upsertAssessment("asm-ransomware", "course-ransomware", "Ransomware Prevention Assessment", 80);
  await upsertQuestions("asm-ransomware", [
    {
      id: "q-rm-1", orderIndex: 0,
      text: "You open an email attachment and a Word document asks you to 'Enable Content' to view it. What should you do?",
      options: [{ id: "a", text: "Click Enable Content — it's needed to view the document" }, { id: "b", text: "Enable Content but only if the email looks legitimate" }, { id: "c", text: "Close the document and report it to IT without enabling content" }, { id: "d", text: "Save the document and open it later" }],
      correctOptionId: "c",
      explanation: "Prompting to 'Enable Content' or 'Enable Macros' is the single most common ransomware delivery mechanism. Never enable macros in unexpected documents. Close the file and report it to IT immediately.",
    },
    {
      id: "q-rm-2", orderIndex: 1,
      text: "Your computer suddenly shows messages saying files are encrypted and demands Bitcoin payment. What is the FIRST thing you should do?",
      options: [{ id: "a", text: "Pay the ransom to recover your files quickly" }, { id: "b", text: "Shut down the computer to stop the encryption" }, { id: "c", text: "Disconnect from the network immediately and call IT" }, { id: "d", text: "Try to find and delete the ransomware yourself" }],
      correctOptionId: "c",
      explanation: "Disconnecting from the network stops ransomware from spreading to other systems. Do not shut down (forensics may need the running state). Call IT immediately — don't email as the email system may be compromised. Do not pay the ransom.",
    },
    {
      id: "q-rm-3", orderIndex: 2,
      text: "What percentage of ransomware attacks begin with a phishing email?",
      options: [{ id: "a", text: "Less than 10%" }, { id: "b", text: "Around 41%" }, { id: "c", text: "Around 70%" }, { id: "d", text: "Nearly 100%" }],
      correctOptionId: "b",
      explanation: "Approximately 41% of ransomware attacks begin with a phishing email, making it the most common initial access vector. This is why phishing awareness is the most impactful security training for employees.",
    },
  ]);

  // ── Course 7: Mobile & Remote Work Security ────────────────────────────────
  await upsertCourse("course-mobile-remote", {
    title: "Mobile & Remote Work Security",
    description: "Keep company data safe when working from home, on the road, or on mobile devices. Public WiFi, VPNs, and device security covered.",
    isMandatory: false,
    passMark: 75,
    estimatedMin: 18,
    complianceFrameworks: ["NIST_CSF", "CIS_CONTROLS", "ISO_27001"],
    track: "SECURITY_AWARENESS",
  });

  const mod7_1 = await upsertModule("mod-mr-1", "course-mobile-remote", "Remote Work Security", 0);
  await upsertLesson("les-mr-1-1", mod7_1.id, 0, "Working Safely from Home and on the Road", `# Remote Work: Extending the Security Perimeter

## Your Home is Now a Branch Office
When you work remotely, your home network becomes part of the company's attack surface. Attackers know remote workers are a softer target.

## Home Network Security

### Secure Your Router
- Change the default admin username and password — defaults are published online
- Use WPA3 or WPA2 encryption (never WEP or open)
- Keep router firmware updated
- Use the guest network for smart home devices and personal devices

### Separate Work and Personal
- Use your company device for work, personal device for personal browsing
- If you must use a personal device for work (BYOD), ensure it meets company security standards (encryption, MDM enrolment, up-to-date OS)

## VPN Usage
Always connect to the company VPN when accessing internal systems remotely. VPN:
- Encrypts your internet traffic from snooping on the local network
- Routes you through the company's security stack (firewall, proxy, DNS filtering)
- Authenticates your device to the corporate network

**Never access company systems over public WiFi without VPN active.**

## Video Call Security
- Use a virtual background to avoid revealing home layout
- Check who has joined before discussing sensitive topics
- Lock meetings with passwords or waiting rooms
- Blur or hide whiteboards/documents visible behind you

## Physical Security
- Lock your screen when stepping away (Win+L or Cmd+Ctrl+Q)
- Position your screen so it cannot be seen by others (shoulder surfing)
- Shred sensitive documents — don't put them in household recycling
- Don't leave company devices unattended in cars`, 8);

  await upsertLesson("les-mr-1-2", mod7_1.id, 1, "Public WiFi and Mobile Device Security", `# Public WiFi & Mobile Devices

## Public WiFi Risks
Coffee shops, hotels, airports, and conference centres offer convenient WiFi — and so do attackers running rogue hotspots.

### Evil Twin Attacks
Attackers set up a WiFi hotspot named "Starbucks Free WiFi" or "Airport_Free_Wifi". When you connect, all your traffic passes through their device.

### Man-in-the-Middle
On poorly secured networks, attackers can intercept unencrypted traffic, inject malicious content into web pages, or steal session cookies.

**Rules for public WiFi:**
1. **Always use VPN** — this encrypts your tunnel regardless of the network
2. Never access banking, corporate systems, or sensitive accounts without VPN
3. Forget public networks after use (auto-join can reconnect you to evil twins)
4. Prefer mobile data (4G/5G) over unknown WiFi when handling sensitive information

## Mobile Device Security

### Basics
- Use a strong PIN/passcode (6+ digits, or biometric + PIN backup)
- Enable device encryption (on by default on modern iOS and Android)
- Enable remote wipe (Find My iPhone, Find My Device for Android)
- Only install apps from official stores (App Store, Google Play)
- Keep the OS updated

### Lost or Stolen Device
If your work device is lost or stolen:
1. Report it to IT **immediately**
2. IT will remotely wipe it before data can be extracted
3. Change passwords for accounts accessed on that device

### App Permissions
Review what permissions apps request. A flashlight app requesting access to your contacts and location is a red flag. Revoke permissions that aren't needed for the app to function.`, 7);

  const asm7 = await upsertAssessment("asm-mobile-remote", "course-mobile-remote", "Mobile & Remote Work Assessment", 75);
  await upsertQuestions("asm-mobile-remote", [
    {
      id: "q-mr-1", orderIndex: 0,
      text: "You're in a coffee shop and need to access the company CRM system. What should you do first?",
      options: [{ id: "a", text: "Connect to 'CoffeeShop_Free_WiFi' and access the CRM normally" }, { id: "b", text: "Connect your VPN before accessing any company systems" }, { id: "c", text: "Use incognito mode for security" }, { id: "d", text: "Access it quickly — it's only a few minutes" }],
      correctOptionId: "b",
      explanation: "Always activate VPN before accessing company systems over public WiFi. Public networks can be monitored or spoofed by attackers. VPN encrypts your traffic and routes it through company security infrastructure.",
    },
    {
      id: "q-mr-2", orderIndex: 1,
      text: "Your work laptop is stolen from your car. What is the most important immediate action?",
      options: [{ id: "a", text: "File a police report" }, { id: "b", text: "Contact IT security immediately so they can remotely wipe the device" }, { id: "c", text: "Change your email password" }, { id: "d", text: "Buy a new laptop" }],
      correctOptionId: "b",
      explanation: "Contacting IT immediately enables them to remotely wipe the device before a thief can extract data. Time is critical — company data and credentials can be accessed quickly if the device isn't encrypted or wiped. File a police report as well, but IT notification comes first.",
    },
  ]);

  // ── Course 8: Incident Reporting & Response ────────────────────────────────
  await upsertCourse("course-incident-response", {
    title: "Incident Reporting & Response",
    description: "Know what to do in the critical first minutes of a security incident. Fast, correct responses limit damage dramatically.",
    isMandatory: true,
    passMark: 80,
    estimatedMin: 15,
    complianceFrameworks: ["NIST_CSF", "ISO_27001", "SOC2", "HIPAA"],
    track: "INCIDENT_RESPONSE",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const mod8_1 = await upsertModule("mod-ir-1", "course-incident-response", "Recognise, Report, Respond", 0);
  await upsertLesson("les-ir-1-1", mod8_1.id, 0, "What Counts as a Security Incident", `# Recognising a Security Incident

## What Is a Security Incident?
Any event that actually or potentially compromises the **confidentiality, integrity, or availability** of information or systems.

## Examples You Might Encounter

| What You See | What It Might Be |
|---|---|
| Unexpected pop-up demanding payment | Ransomware |
| Antivirus detects and quarantines a file | Malware infection attempt |
| You clicked a phishing link | Potential credential compromise |
| You sent an email to the wrong person | Data breach |
| Your account shows logins from unknown locations | Account compromise |
| A colleague reports receiving an email "from you" you didn't send | Account compromise |
| Confidential file found in a public Teams channel | Unauthorised disclosure |
| Paper documents containing personal data found in recycling | Data breach |
| Colleague asks you to share credentials | Insider threat / social engineering |

## The Key Principle: Report Early
The sooner a security team knows about an incident, the faster they can contain it. **No incident is too small to report.** Security teams do not blame employees who report in good faith — they work with them.

The breach that costs millions is rarely the click — it's the **week of silence** that follows, during which the attacker escalates privileges and exfiltrates data.

## Near-Misses Count Too
If you almost fell for a phishing email, report it even if you didn't click. Intelligence about attack campaigns helps protect your colleagues.`, 7);

  await upsertLesson("les-ir-1-2", mod8_1.id, 1, "How to Report and What Happens Next", `# Incident Response: Your Role

## How to Report a Suspected Incident

### Do:
1. **Stop what you're doing** — don't try to fix it yourself
2. **Preserve evidence** — don't delete emails, files, or browser history
3. **Disconnect from network** if you suspect active malware (unplug Ethernet, disable WiFi)
4. **Contact IT Security** immediately:
   - Phone: use the Security Hotline (posted on your intranet)
   - Email: security@[company].com (if email is not the compromised channel)
   - In person: go directly to the IT team if possible
5. **Document what happened** — time, what you did, what you saw
6. **Cooperate fully** with the investigation

### Don't:
- Don't tell colleagues before reporting to IT (it may tip off an insider)
- Don't post about it on social media
- Don't try to remove the malware yourself
- Don't reuse affected passwords before IT advises you to
- Don't shut down systems unless IT directs you to

## What Happens After You Report
1. **Triage** — IT assesses severity and scope
2. **Containment** — isolate affected systems to prevent spread
3. **Eradication** — remove the threat
4. **Recovery** — restore systems from clean backups
5. **Post-incident review** — what happened, what needs fixing

## No Blame, Just Response
Security teams understand that mistakes happen. Employees who report incidents quickly are helping the organisation. Those who cover up incidents create catastrophic outcomes. Psychological safety around reporting is a sign of a healthy security culture.`, 7);

  const asm8 = await upsertAssessment("asm-incident-response", "course-incident-response", "Incident Response Assessment", 80);
  await upsertQuestions("asm-incident-response", [
    {
      id: "q-ir-1", orderIndex: 0,
      text: "You accidentally sent an email containing a spreadsheet with 200 customer records to the wrong recipient. This is:",
      options: [{ id: "a", text: "Not serious if you quickly ask them to delete it" }, { id: "b", text: "A personal data breach that must be reported to your manager and DPO immediately" }, { id: "c", text: "Only a problem if the recipient shares the data further" }, { id: "d", text: "Not reportable unless a customer complains" }],
      correctOptionId: "b",
      explanation: "This is a personal data breach under GDPR, regardless of whether any harm occurs. You must report it internally immediately. The organisation has 72 hours to notify the regulator. Asking the recipient to delete it does not resolve the breach.",
    },
    {
      id: "q-ir-2", orderIndex: 1,
      text: "You suspect your computer is infected with malware. You should:",
      options: [{ id: "a", text: "Restart the computer to clear the malware" }, { id: "b", text: "Download an antivirus tool from the internet to clean it" }, { id: "c", text: "Disconnect from the network and call IT immediately" }, { id: "d", text: "Keep working but don't open sensitive files" }],
      correctOptionId: "c",
      explanation: "Disconnect from the network to prevent the malware from spreading or communicating with command servers. Do not restart (may destroy forensic evidence). Do not download tools (you may download more malware). Call IT — they will guide the response.",
    },
    {
      id: "q-ir-3", orderIndex: 2,
      text: "Why is reporting a security incident quickly so critical?",
      options: [{ id: "a", text: "To avoid being blamed for it" }, { id: "b", text: "To meet regulatory reporting deadlines only" }, { id: "c", text: "Fast response dramatically limits how far an attacker can spread and how much damage they can do" }, { id: "d", text: "So IT can update the antivirus signatures" }],
      correctOptionId: "c",
      explanation: "Speed of response is the most critical factor in limiting breach impact. Attackers who dwell undetected for days or weeks can exfiltrate data, compromise more accounts, and deploy ransomware across the entire organisation. Early reporting enables early containment.",
    },
  ]);

  console.log("✅ Courses, modules, lessons & assessments (8 courses)");

  // ════════════════════════════════════════════════════════════════════════════
  //  SAMPLE EXERCISE 9: General > Phishing — Business Email Compromise
  // ════════════════════════════════════════════════════════════════════════════

  await upsertCourse("course-bec-wire-fraud", {
    title: "Business Email Compromise: Recognising Wire Fraud",
    description:
      "Business Email Compromise (BEC) is the costliest form of cybercrime — over $50 billion lost globally since 2013. This exercise teaches you to recognise BEC attempts, verify unusual requests, and protect your organisation from fraudulent wire transfers and payroll redirects.",
    isMandatory: false,
    passMark: 80,
    estimatedMin: 20,
    complianceFrameworks: ["GENERAL", "NIST_CSF", "SOC2"],
    track: "PHISHING_DEFENSE",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const modBec1 = await upsertModule("mod-bec-1", "course-bec-wire-fraud", "What Is Business Email Compromise?", 0);

  await upsertLesson(
    "les-bec-1-1",
    modBec1.id,
    0,
    "Overview and Real-World Scale",
    `# Business Email Compromise: The Costliest Cyber Threat You May Not Have Heard Of

## What Is Business Email Compromise?

Business Email Compromise (BEC) is a type of fraud in which an attacker uses email — either a compromised real account or a convincing lookalike address — to impersonate a trusted person and trick employees into sending money, changing bank details, or sharing sensitive data.

Unlike ransomware, BEC rarely involves malware. There are no attachments to scan, no suspicious links to block. The weapon is the email itself: a message that looks exactly like one you might receive from your CEO, a supplier, or a payroll system.

## The Scale of the Problem

The FBI's Internet Crime Complaint Center (IC3) recorded $2.9 billion in adjusted losses from BEC in 2023 alone — making it the highest-loss cybercrime category for the seventh consecutive year. Since 2016, cumulative global losses have exceeded $50 billion.

These are not losses from technical exploits. They are losses from employees who received a convincing email and acted on it without verification.

## Why BEC Is So Effective

BEC exploits legitimate email infrastructure and human psychology simultaneously:

- The sender name looks right, even if the email address is slightly wrong
- The request is framed as urgent and confidential, suppressing the instinct to verify
- The instructions specifically block your usual verification steps ("I'm in meetings — don't call")
- One well-targeted email can cost an organisation millions within hours

The 2019 Toyota Boshoku case resulted in a loss of approximately $37 million from a single BEC email. The 2020 Puerto Rico government case lost $2.6 million. In 2021, the Levitas Capital hedge fund lost $8.7 million and subsequently closed.

These are not isolated incidents. BEC attacks are methodical, researched, and delivered at scale.`,
    8
  );

  await upsertLesson(
    "les-bec-1-2",
    modBec1.id,
    1,
    "How Attackers Research and Craft BEC Attacks",
    `# How Attackers Build a BEC Attack

## Step 1: Reconnaissance

Before sending a single email, attackers spend time learning about your organisation. They use:

- **LinkedIn:** Job titles, reporting lines, who handles finance, who can authorise payments
- **Company websites:** Executive names, email formats (firstname.lastname@company.com)
- **Press releases and filings:** Acquisition announcements, quarterly results, new vendor relationships
- **Previous data breaches:** Email addresses and sometimes passwords from compromised databases

A BEC attacker targeting your finance team may know your CFO's name, your AP clerk's name, that you recently changed payroll providers, and that your CEO is travelling this week. All of this is publicly available.

## Step 2: Account Compromise or Lookalike Setup

Attackers either:

**Compromise a real account** — using phished or purchased credentials, they gain access to a genuine executive's email account. Emails sent from a real account pass every technical check. This is the hardest variant to detect.

**Create a lookalike domain** — a domain registered to closely mimic the real one:
- company.com becomes company-corp.com, or cornpany.com (rn looks like m)
- The email address may be identical to the real one except for this domain

## Step 3: Delivery and Manipulation

The email arrives in a plausible context. Common scenarios include:

- CEO requests an urgent wire transfer to a new account for a confidential acquisition
- Supplier emails updated banking details just before a scheduled payment
- HR informs payroll of a direct deposit change for a named employee
- A new vendor sends their first invoice with routing details

All of these follow predictable, real business processes — which is exactly why they work.

## Step 4: Urgency and Verification Blocks

Every effective BEC email includes two elements:

1. **Urgency** — "Today only", "before close of business", "the deal falls through if we miss this window"
2. **A reason not to verify** — "I'm unavailable by phone", "this is confidential — don't discuss", "trust me on this one"

These two elements are the clearest red flags in any BEC attempt. Legitimate business requests do not come with built-in instructions to bypass your verification process.`,
    9
  );

  const modBec2 = await upsertModule("mod-bec-2", "course-bec-wire-fraud", "Recognition and Response", 1);

  await upsertLesson(
    "les-bec-2-1",
    modBec2.id,
    0,
    "Red Flags, Verification, and What to Do If You Are Targeted",
    `# Recognising, Verifying, and Responding to BEC Attempts

## Universal Red Flags in BEC Emails

Regardless of who the email appears to be from, treat the following as warning signs:

1. **Request to send money or change banking details** — any such request arriving by email alone should be independently verified before action
2. **Urgency with a reason to bypass normal process** — "urgent", "today", combined with "don't call", "keep this confidential"
3. **Slightly wrong sender email address** — check the full address, not just the display name
4. **Request that skips your normal approval chain** — "just between us", "don't loop in finance"
5. **New bank account details** — legitimate suppliers and payroll systems very rarely change banking details; when they do, they follow a formal process with written confirmation and callback verification

## How to Verify

The correct response to any unusual financial request is to verify it through a channel you control — not through the email.

**Call the requester on a number you already know** — a number from your company directory, from a previous email thread, or from the organisation's official website. Do not use a number included in the suspicious email.

If the request is from your CEO, call their mobile directly. If the request is from a supplier, call their main office. If the request is from HR, walk to the HR department.

**Never verify by replying to the suspicious email.** The attacker controls that inbox.

## The Correct Organisational Response

Most organisations have financial controls specifically designed to prevent this:

- Dual authorisation requirements for transfers above a threshold
- Out-of-band verification for new banking details
- Callback procedures for payroll changes

These controls exist because BEC is a known and frequent attack. Following the procedure — even when the CEO is "waiting" — is the correct behaviour. No senior leader should override financial controls by email.

If a financial control blocks an urgent request, the requestor can pick up the phone.

## What to Do If You Suspect You Have Already Complied

If you have already transferred funds or changed banking details in response to what may have been a BEC email:

1. Contact your bank immediately to request a recall of the payment — speed is critical; banks can sometimes reverse recent transfers
2. Report the incident to your organisation's security and finance teams immediately
3. Report the incident to your national law enforcement authority (FBI's IC3 in the US, Action Fraud in the UK)
4. Preserve all related emails as evidence — do not delete anything
5. Do not notify the attacker that you have identified the fraud — they may have other access

Time is the most critical variable. Banks have reported successfully recalling funds in cases where the victim reported within hours. In cases where reporting was delayed by days, recovery was rare.`,
    10
  );

  const asmBec = await upsertAssessment("asm-bec-wire-fraud", "course-bec-wire-fraud", "BEC Knowledge Check", 80);
  await upsertQuestions("asm-bec-wire-fraud", [
    {
      id: "q-bec-1", orderIndex: 0,
      text: "You receive an email appearing to be from your CEO asking you to wire £40,000 to a new account today for a confidential acquisition. The email says 'I'm in board meetings all day — please don't call, just get this done.' What do you do?",
      options: [
        { id: "a", text: "Wire the funds — it is from the CEO and marked confidential" },
        { id: "b", text: "Reply to the email to get more details before acting" },
        { id: "c", text: "Call the CEO directly on their known mobile number to verify, regardless of the instruction not to" },
        { id: "d", text: "Ask a colleague whether to proceed" },
      ],
      correctOptionId: "c",
      explanation: "The instruction not to call is itself a red flag. Legitimate financial requests can always wait for a brief phone verification. Call the CEO on a number you already know — not one from the email. If the request is genuine, a 2-minute call will confirm it. If it is fraud, you have just prevented a significant loss.",
    },
    {
      id: "q-bec-2", orderIndex: 1,
      text: "Your regular supplier emails to say they have changed their bank details and asks you to update your records before the next payment. What is the safest first step?",
      options: [
        { id: "a", text: "Update the bank details immediately — you recognise the supplier" },
        { id: "b", text: "Reply to the email confirming you have received the new details" },
        { id: "c", text: "Call the supplier on their previously known phone number to confirm the change independently" },
        { id: "d", text: "Wait to see if the next invoice also shows the new details" },
      ],
      correctOptionId: "c",
      explanation: "Fraudulent banking detail changes are one of the most common BEC variants. Always verify any change of payment details by calling the supplier on a number from your existing records — never use contact details from the email requesting the change. Replying to the email confirms nothing because the attacker controls the inbox.",
    },
    {
      id: "q-bec-3", orderIndex: 2,
      text: "Which two elements together are the strongest indicators that a financial email request may be a BEC attempt?",
      options: [
        { id: "a", text: "The email uses formal language and includes a company logo" },
        { id: "b", text: "Urgency combined with a specific instruction not to verify through normal channels" },
        { id: "c", text: "The email arrives on a Friday afternoon" },
        { id: "d", text: "The amount requested is larger than usual" },
      ],
      correctOptionId: "b",
      explanation: "Urgency plus a built-in reason to skip verification (don't call, keep this confidential, I'm unavailable) is the defining pattern of BEC. Legitimate business requests can withstand a brief verification call. Fraudulent ones cannot — which is why attackers work to prevent it.",
    },
    {
      id: "q-bec-4", orderIndex: 3,
      text: "You have just wired funds in response to what you now believe was a BEC email. What is the single most time-critical first action?",
      options: [
        { id: "a", text: "Email your manager to let them know" },
        { id: "b", text: "Contact your bank immediately to request a transfer recall" },
        { id: "c", text: "Report it to the police and wait for guidance" },
        { id: "d", text: "Document what happened before doing anything else" },
      ],
      correctOptionId: "b",
      explanation: "Banks have a narrow window in which they can recall a fraudulent transfer — sometimes as little as a few hours. Calling your bank immediately is the most time-critical action. Simultaneously notify your security and finance teams. Police and documentation are also necessary but come after the bank call.",
    },
    {
      id: "q-bec-5", orderIndex: 4,
      text: "An attacker has registered the domain 'company-finance.net' to impersonate your organisation. They send an email from 'cfo@company-finance.net'. What is the best way to identify this as fraudulent before acting?",
      options: [
        { id: "a", text: "Check whether the email has a professional signature" },
        { id: "b", text: "See whether the email was sent during business hours" },
        { id: "c", text: "Read the full sender email address carefully and compare it against your known CFO email address" },
        { id: "d", text: "Check whether the email was flagged by spam filters" },
      ],
      correctOptionId: "c",
      explanation: "Email display names can be set to anything. Always read the full email address — the part after the @ sign. 'company-finance.net' is not your company's domain. Spam filters do not reliably catch BEC emails because the domain may be legitimately registered and the email contains no malicious links.",
    },
  ]);

  // ════════════════════════════════════════════════════════════════════════════
  //  SAMPLE EXERCISE 10: Healthcare > HIPAA — The Minimum Necessary Standard
  // ════════════════════════════════════════════════════════════════════════════

  await upsertCourse("course-hipaa-minimum-necessary", {
    title: "HIPAA and the Minimum Necessary Standard",
    description:
      "The Minimum Necessary Standard is one of the most frequently violated HIPAA requirements. This exercise explains what it means, how it applies to everyday tasks in a healthcare setting, and what happens when it is not followed. Designed for clinical and administrative healthcare staff.",
    isMandatory: false,
    passMark: 80,
    estimatedMin: 22,
    complianceFrameworks: ["HIPAA", "GENERAL"],
    track: "DATA_PRIVACY",
    isRecurring: true,
    recurringIntervalMonths: 12,
  });

  const modHipaa1 = await upsertModule("mod-hipaa-1", "course-hipaa-minimum-necessary", "Understanding HIPAA and PHI", 0);

  await upsertLesson(
    "les-hipaa-1-1",
    modHipaa1.id,
    0,
    "Overview: What HIPAA Requires and Why It Exists",
    `# HIPAA and Patient Privacy: The Foundation

## What Is HIPAA?

The Health Insurance Portability and Accountability Act (HIPAA) was signed into United States federal law in 1996. Its Privacy Rule, which took effect in 2003, establishes the national standard for protecting individuals' medical records and other personal health information (PHI — Protected Health Information).

Any organisation that creates, receives, maintains, or transmits PHI in the course of providing or paying for healthcare is a Covered Entity under HIPAA. This includes hospitals, clinics, physician practices, pharmacies, and health insurance plans. Business Associates — contractors who handle PHI on behalf of covered entities — are also bound by HIPAA requirements.

HIPAA is not a bureaucratic formality. It exists because the unauthorised exposure of health information causes real harm to real people: discrimination in employment or insurance, relationship damage, stigma around mental health or substance abuse diagnoses, and violations of the most intimate aspects of a person's life.

## What Is Protected Health Information?

Protected Health Information (PHI) is any information that:

- Relates to a person's past, present, or future physical or mental health condition, or to the payment for healthcare; AND
- Can be used to identify the individual

Individually identifiable elements include: names, geographic data (including zip code), dates (other than year), phone numbers, email addresses, social security numbers, medical record numbers, and in many cases even photographs.

PHI is protected regardless of format — paper, electronic, verbal, or any other medium.

## The Core HIPAA Privacy Requirements

HIPAA's Privacy Rule establishes that covered entities may use and disclose PHI only in specifically defined circumstances. The most important principles for day-to-day practice are:

- **Minimum Necessary:** Use or disclose only the PHI needed to accomplish the specific purpose
- **Notice of Privacy Practices:** Patients must be informed of how their information is used
- **Patient Rights:** Patients have the right to access, amend, and receive an accounting of disclosures of their PHI
- **Safeguards:** Administrative, physical, and technical safeguards must protect PHI from unauthorised access

Enforcement is carried out by the Department of Health and Human Services Office for Civil Rights (OCR). Fines range from $100 per violation (unknowing violation) to $50,000 per violation (wilful neglect) with annual maximums of $1.9 million per violation category.`,
    8
  );

  await upsertLesson(
    "les-hipaa-1-2",
    modHipaa1.id,
    1,
    "The Minimum Necessary Standard: What It Means in Practice",
    `# The Minimum Necessary Standard

## What the Rule Requires

The Minimum Necessary Standard (45 CFR 164.502(b)) requires that covered entities make reasonable efforts to limit PHI use, disclosure, and requests to the minimum necessary to accomplish the intended purpose.

In plain terms: if you need a patient's medication list to complete a specific task, you should not access — and should not be able to access — their full psychiatric history, their HIV status, their previous hospital admissions, or any other information not required for that task.

This applies to:
- Uses of PHI within the organisation (employees accessing patient records)
- Disclosures of PHI outside the organisation (sharing records with another provider or insurer)
- Requests for PHI from other organisations

## Everyday Violations of the Minimum Necessary Standard

The most common HIPAA violations in healthcare settings involve staff accessing records they have no clinical or administrative reason to view. The OCR reports consistently identify "impermissible access" as among the most frequently investigated complaint categories.

**Examples of minimum necessary violations:**

- A nurse accessing the records of a celebrity patient admitted to their hospital, not because they are treating the patient, but out of curiosity
- An administrator looking up the record of a family member, former colleague, or neighbour without a work-related reason
- A clinical team requesting a patient's complete 10-year medical history from a referring provider when only the last 12 months of records are relevant to the referral
- Sharing a full patient chart with a specialist when only the relevant section (for example, cardiology results) is needed for the consultation

The 2014 Advocate Health Care settlement ($5.55 million) and the 2018 Anthem settlement ($16 million) both involved failures to limit access to the minimum necessary — both resulted from employees accessing far more records than their roles required.

## Role-Based Access and Your Responsibility

Compliant organisations implement role-based access controls: your system credentials should grant you access only to the records and data types your role requires. This is the technical implementation of the minimum necessary standard.

However, technical access controls are not a complete defence. You have a personal professional obligation to access only records you have a legitimate reason to view — even if the system does not technically prevent broader access.

"I had access to it" is not a defence under HIPAA. Access logs are reviewed, and pattern analysis can identify unusual access behaviour, including accessing records of colleagues, public figures, or patients outside your care team.`,
    9
  );

  const modHipaa2 = await upsertModule("mod-hipaa-2", "course-hipaa-minimum-necessary", "Application and Breach Response", 1);

  await upsertLesson(
    "les-hipaa-2-1",
    modHipaa2.id,
    0,
    "Scenarios, Breach Obligations, and What to Do If You Make a Mistake",
    `# Applying the Minimum Necessary Standard — and Responding to Breaches

## How to Apply Minimum Necessary in Common Situations

**Scenario 1: A colleague asks you to pull a patient's chart while they are with another patient.**
Ask what specific information they need. Pull only that section. A physician covering a colleague's patients needs active medication lists and current diagnoses — not the patient's complete psychiatric history or prior surgical records from a different facility.

**Scenario 2: A patient's family member calls and asks for an update on their condition.**
Unless the patient has explicitly authorised disclosure to that individual, you may only confirm whether the patient is receiving care. You may not disclose diagnosis, treatment, or prognosis — even to a spouse, parent, or adult child — without the patient's prior written authorisation or in specific emergency circumstances.

**Scenario 3: A law firm sends a request for a patient's records in connection with litigation.**
Do not release records without proper legal process (a valid subpoena or court order) and review by your Privacy Officer. Release only the specific records identified in the legal request — not the full medical history. Route all such requests through your organisation's legal or compliance department.

**Scenario 4: You are asked to share records with another provider for treatment purposes.**
Treatment is one of the permitted uses under HIPAA. However, even for treatment, you should share only the records relevant to the treatment being provided. A dermatology referral does not require access to substance abuse treatment records.

## What Constitutes a HIPAA Breach?

A breach is any impermissible use or disclosure of PHI that compromises the privacy or security of the information. Common breach scenarios include:

- Emailing PHI to the wrong recipient
- Mailing a paper record to the wrong address
- PHI visible on an unattended screen in a public area
- Loss or theft of a device containing unencrypted PHI
- An employee accessing records without a legitimate purpose

## Breach Notification Requirements

Under the HIPAA Breach Notification Rule:

- **Covered entities must notify affected individuals** within 60 days of discovering a breach
- **Covered entities must notify HHS** — breaches affecting 500 or more individuals must be reported promptly; smaller breaches must be reported annually
- **Breaches affecting 500+ individuals in a state or jurisdiction** require notification to prominent media outlets
- **Business Associates must notify** their covered entity partners without unreasonable delay and within 60 days of discovery

The 60-day clock starts when any employee of the organisation first knows — or should reasonably have known — about the breach.

## If You Believe a Breach Has Occurred

Report it to your Privacy Officer or Compliance team immediately. Do not delay to assess severity yourself — the OCR has taken the position that the clock starts when you first become aware, not when you finish your own investigation.

Do not attempt to cover up or minimise a breach. Organisations that self-report promptly and cooperate fully with investigations consistently receive more favourable enforcement outcomes than those that delay, conceal, or minimise. The $16 million Anthem fine was compounded by the scale and duration of the breach combined with pre-existing known vulnerabilities that had not been addressed.`,
    10
  );

  const asmHipaa = await upsertAssessment("asm-hipaa-minimum-necessary", "course-hipaa-minimum-necessary", "HIPAA Knowledge Check", 80);
  await upsertQuestions("asm-hipaa-minimum-necessary", [
    {
      id: "q-hipaa-1", orderIndex: 0,
      text: "A celebrity is admitted to your hospital. You are not on their care team, but you are curious about their condition. You have system access to pull their record. Should you?",
      options: [
        { id: "a", text: "Yes — you have legitimate system access and are just looking" },
        { id: "b", text: "Yes — as a hospital employee you are entitled to see any patient record" },
        { id: "c", text: "No — accessing records without a work-related reason violates HIPAA regardless of technical access" },
        { id: "d", text: "Only if you do not share what you see with others" },
      ],
      correctOptionId: "c",
      explanation: "The Minimum Necessary Standard requires a legitimate work-related reason to access PHI. Technical access is not the same as authorised access. High-profile patient accesses are among the most commonly investigated HIPAA violations. Access logs capture every record view.",
    },
    {
      id: "q-hipaa-2", orderIndex: 1,
      text: "A patient's adult daughter calls asking for an update on her mother's surgical procedure. The mother has not provided written authorisation. What should you do?",
      options: [
        { id: "a", text: "Provide the update — she is immediate family" },
        { id: "b", text: "Confirm the patient is receiving care but do not disclose clinical details without patient authorisation" },
        { id: "c", text: "Ask her to come in person and then share the information" },
        { id: "d", text: "Transfer her to the surgeon to handle" },
      ],
      correctOptionId: "b",
      explanation: "HIPAA does not automatically allow disclosure to family members — even immediate family. Without the patient's prior authorisation, you may confirm that the patient is receiving care but may not disclose clinical details unless the patient is incapacitated and you determine it is in their best interest. The correct and safest response is to note the contact and arrange for the patient to provide authorisation.",
    },
    {
      id: "q-hipaa-3", orderIndex: 1,
      text: "You are preparing a referral for a patient seeing a cardiologist. Which records should you send?",
      options: [
        { id: "a", text: "The patient's complete medical history going back 10 years" },
        { id: "b", text: "Only the records directly relevant to the cardiac referral" },
        { id: "c", text: "Everything you have — the cardiologist can decide what is relevant" },
        { id: "d", text: "Whatever the referral template includes by default" },
      ],
      correctOptionId: "b",
      explanation: "The Minimum Necessary Standard applies to disclosures for treatment as well as all other purposes. Send only what is directly relevant to the specific referral. A cardiologist does not need psychiatric records, substance abuse history, or unrelated surgical history in order to perform a cardiac evaluation.",
    },
    {
      id: "q-hipaa-4", orderIndex: 2,
      text: "You accidentally email a patient's discharge summary to the wrong address. You realise your mistake immediately. What should you do?",
      options: [
        { id: "a", text: "Email the wrong recipient asking them to delete it — the problem is resolved" },
        { id: "b", text: "Tell your supervisor only if the recipient responds to confirm they saw it" },
        { id: "c", text: "Report it to your Privacy Officer immediately — this is a HIPAA breach regardless of whether harm occurs" },
        { id: "d", text: "Wait 24 hours to see whether the email bounces before escalating" },
      ],
      correctOptionId: "c",
      explanation: "An impermissible disclosure of PHI is a HIPAA breach the moment it occurs — harm does not need to be proven. The 60-day notification clock starts when the breach is discovered. Prompt internal reporting allows your organisation to assess, notify affected individuals, and meet regulatory obligations.",
    },
    {
      id: "q-hipaa-5", orderIndex: 3,
      text: "Under HIPAA's Breach Notification Rule, how quickly must covered entities notify affected individuals of a breach?",
      options: [
        { id: "a", text: "Within 24 hours" },
        { id: "b", text: "Within 30 days" },
        { id: "c", text: "Within 60 days of discovering the breach" },
        { id: "d", text: "Within 90 days" },
      ],
      correctOptionId: "c",
      explanation: "HIPAA's Breach Notification Rule requires covered entities to notify affected individuals without unreasonable delay and within 60 days of discovering the breach. For breaches affecting 500 or more individuals in a state, prominent media notification is also required. HHS must be notified promptly for large breaches and annually for smaller ones.",
    },
  ]);

  console.log("✅ Sample exercises 9 & 10 (BEC Wire Fraud + HIPAA Minimum Necessary)");

  // ════════════════════════════════════════════════════════════════════════════
  //  SIMULATION TEMPLATES
  // ════════════════════════════════════════════════════════════════════════════

  // ── EMAIL Templates ─────────────────────────────────────────────────────────

  await upsertTemplate("tmpl-email-password-reset", {
    name: "IT: Password Reset Required (EASY)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.EASY,
    attackTactic: "credential_harvest",
    payload: {
      sender: "it-support@c0mpany-helpdesk.com",
      senderName: "IT Helpdesk",
      subject: "URGENT: Your Password Expires in 24 Hours — Action Required",
      body: `<p>Dear User,</p>
<p>Our systems have detected that your network password is due to expire in <strong>24 hours</strong>. To avoid being locked out of your account and disrupting your work, please reset your password immediately.</p>
<p><a href="#" style="background:#0078d4;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Reset My Password Now</a></p>
<p>If you do not reset your password within 24 hours, your account will be automatically suspended and you will need to contact HR to reinstate access.</p>
<p>Regards,<br>IT Helpdesk Team</p>`,
    },
    redFlags: [
      "Sender domain 'c0mpany-helpdesk.com' uses a zero instead of the letter O",
      "Generic greeting 'Dear User' — IT would use your name",
      "Artificial urgency: 24-hour deadline designed to prevent careful thinking",
      "Threatening language: 'account will be automatically suspended'",
      "Hovering the link reveals it does not go to your company's real IT portal",
    ],
  });

  await upsertTemplate("tmpl-email-ceo-wire", {
    name: "CEO Wire Transfer Request — BEC (HARD)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.HARD,
    attackTactic: "authority",
    payload: {
      sender: "ceo@company-corp.net",
      senderName: "Jonathan Wells (CEO)",
      subject: "Confidential — Urgent Wire Transfer Required Today",
      body: `<p>Hi,</p>
<p>I need your help with something time-sensitive. We are finalising a confidential acquisition and our legal team needs a payment processed today to secure the deal. This is commercially sensitive so please do not discuss with anyone internally until it is complete.</p>
<p>Please arrange a wire transfer of £87,500 to the following account:</p>
<p>Bank: Barclays<br>Account Name: Meridian Advisory Ltd<br>Sort Code: 20-45-67<br>Account Number: 83726194<br>Reference: MAL-2024-Q4</p>
<p>Let me know once it's done. I'm in meetings all afternoon so please don't call — email is fine.</p>
<p>Jonathan</p>`,
    },
    redFlags: [
      "Sender domain 'company-corp.net' does not match the real company domain",
      "Request to bypass normal approval processes for an unusually large amount",
      "Explicitly asks you NOT to verify by phone ('I'm in meetings — email is fine')",
      "Unusual urgency and secrecy instructions",
      "CEO would not normally send payment instructions directly to a non-finance employee",
      "Payment to an unfamiliar company not in your supplier list",
    ],
  });

  await upsertTemplate("tmpl-email-fake-invoice", {
    name: "Finance: Supplier Invoice with Updated Bank Details (MEDIUM)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.MEDIUM,
    attackTactic: "authority",
    payload: {
      sender: "accounts@technova-solutions.co",
      senderName: "TechNova Solutions — Accounts",
      subject: "Invoice INV-2024-0892 — Updated Banking Details",
      body: `<p>Dear Finance Team,</p>
<p>Please find attached our invoice INV-2024-0892 for £12,450 (net 30 days).</p>
<p>Please note that we have recently changed our banking provider. Please update your records to use our new bank details for all future payments:</p>
<p><strong>Bank:</strong> Lloyds Bank<br><strong>Account Name:</strong> TechNova Solutions Ltd<br><strong>Sort Code:</strong> 30-12-88<br><strong>Account Number:</strong> 61029374</p>
<p>Please confirm receipt of this email and that the bank details have been updated.</p>
<p>Kind regards,<br>Sarah Mitchell<br>Accounts Receivable<br>TechNova Solutions</p>`,
    },
    redFlags: [
      "Sender domain '.co' instead of the expected '.com' — subtle lookalike",
      "Requests bank detail changes via email without secondary verification",
      "Legitimate suppliers change banking details very rarely — treat with suspicion",
      "Asks for confirmation that new details have been saved — social engineering confirmation",
      "No phone number provided to verify the request",
    ],
  });

  await upsertTemplate("tmpl-email-hr-benefits", {
    name: "HR: Annual Benefits Enrollment Closing (MEDIUM)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.MEDIUM,
    attackTactic: "credential_harvest",
    payload: {
      sender: "hr-benefits@company-hr-portal.com",
      senderName: "HR Benefits Team",
      subject: "Action Required: Benefits Enrollment Closes Friday — Don't Miss Out",
      body: `<p>Dear Team Member,</p>
<p>This is a reminder that the annual benefits enrollment window closes <strong>this Friday at 5:00pm</strong>. If you do not make your elections, you will be defaulted to last year's selections — which may not reflect your current needs.</p>
<p>To review and update your benefits, please log in to the HR portal:</p>
<p><a href="#" style="color:#e8490f;font-weight:bold;">Access My Benefits Portal →</a></p>
<p>You will need your employee ID and password to log in.</p>
<p>HR Benefits Team</p>`,
    },
    redFlags: [
      "Sender domain 'company-hr-portal.com' is an external domain, not the company's own",
      "The link does not go to your real HR system — hover to check the destination",
      "Legitimate HR benefits systems would be accessible from your company intranet",
      "Urgency tactic: 'closes Friday' — check the real deadline on your company intranet",
      "Asking you to log in via an emailed link rather than navigating directly to the portal",
    ],
  });

  await upsertTemplate("tmpl-email-account-compromised", {
    name: "IT Security: Your Account Has Been Compromised (EASY)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.EASY,
    attackTactic: "urgency",
    payload: {
      sender: "security-alert@microsoft-security-centre.com",
      senderName: "Microsoft Security",
      subject: "⚠️ Alert: Suspicious Sign-In Detected on Your Microsoft Account",
      body: `<p>We detected a suspicious sign-in attempt to your Microsoft 365 account from an unrecognised device.</p>
<p><strong>Location:</strong> Moscow, Russia<br><strong>Time:</strong> Today at 02:14 AM<br><strong>Device:</strong> Unknown Windows PC</p>
<p>If this wasn't you, your account may be compromised. Please verify your identity immediately to secure your account.</p>
<p><a href="#" style="background:#d13438;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Secure My Account Now</a></p>
<p>If you do not verify within 2 hours, your account will be locked as a precaution.</p>
<p>Microsoft Security Team</p>`,
    },
    redFlags: [
      "Sender domain 'microsoft-security-centre.com' — Microsoft uses microsoft.com",
      "Emotional trigger: Moscow location is designed to alarm you",
      "Artificial 2-hour deadline to prevent rational thinking",
      "Microsoft would direct you to sign in at microsoft.com — never via an emailed link",
      "Verify legitimate Microsoft alerts by going to account.microsoft.com directly",
    ],
  });

  await upsertTemplate("tmpl-email-docusign", {
    name: "DocuSign: Document Awaiting Your Signature (MEDIUM)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.MEDIUM,
    attackTactic: "credential_harvest",
    payload: {
      sender: "dse@docusign-notifications.net",
      senderName: "DocuSign",
      subject: "Reminder: Contract for Signature — Expires in 48 Hours",
      body: `<table style="max-width:600px;font-family:Arial;border:1px solid #ddd;padding:20px;">
<tr><td><img src="https://via.placeholder.com/100x40?text=DocuSign" alt="DocuSign" /><hr/>
<p>You have a document waiting for your electronic signature.</p>
<p><strong>From:</strong> Legal Department<br><strong>Document:</strong> Employment Contract Amendment 2024<br><strong>Expires:</strong> In 48 hours</p>
<p><a href="#" style="background:#ffb300;color:black;padding:12px 24px;text-decoration:none;border-radius:4px;">Review and Sign Document</a></p>
<p style="font-size:11px;color:#999">You are receiving this because you were designated as a signer. DocuSign processes your information as a Data Controller. Privacy Policy</p>
</td></tr></table>`,
    },
    redFlags: [
      "Sender domain 'docusign-notifications.net' — DocuSign emails come from docusign.net or docusign.com",
      "Unexpected document you were not informed about through other channels",
      "Clicking 'Review and Sign' goes to a credential-harvesting page, not DocuSign",
      "Verify any DocuSign document by logging into docusign.com directly and checking your inbox there",
      "48-hour expiry adds artificial pressure",
    ],
  });

  await upsertTemplate("tmpl-email-payroll", {
    name: "HR: Update Your Payroll Direct Deposit Details (HARD)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.HARD,
    attackTactic: "authority",
    payload: {
      sender: "payroll@hr-internal-system.com",
      senderName: "Payroll Department",
      subject: "Action Required: Update Your Direct Deposit Before Next Pay Run",
      body: `<p>Dear Team Member,</p>
<p>We are migrating to a new payroll system. To ensure your salary is paid without interruption, all employees are required to re-confirm their bank account details by <strong>Thursday 5pm</strong>.</p>
<p>Please click below to update your details in the new system:</p>
<p><a href="#" style="background:#1a6e3c;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Update My Bank Details</a></p>
<p>Employees who do not update their details by the deadline may experience a delay of up to 14 days in their next salary payment.</p>
<p>Payroll Team</p>`,
    },
    redFlags: [
      "Sender domain 'hr-internal-system.com' is external — your HR system would be on a company domain",
      "Legitimate payroll updates are made via your company's HR self-service portal, never via an emailed link",
      "Salary delay threat is designed to coerce immediate action without verification",
      "No phone number or named contact to verify with",
      "Verify any payroll change requests by calling HR directly or logging into your company HR system",
    ],
  });

  await upsertTemplate("tmpl-email-shared-doc", {
    name: "SharePoint: Shared Document Waiting for You (EASY)",
    type: SimulationType.EMAIL,
    difficulty: SimulationDifficulty.EASY,
    attackTactic: "credential_harvest",
    payload: {
      sender: "no-reply@sharepoint-cloud-docs.com",
      senderName: "Microsoft SharePoint",
      subject: "James Walker shared 'Q4 Strategy Plan.pdf' with you",
      body: `<table style="max-width:600px;font-family:'Segoe UI',sans-serif;">
<tr><td style="padding:20px">
<p>🗂️ <strong>James Walker</strong> shared a file with you</p>
<p style="font-size:18px;font-weight:bold;">Q4 Strategy Plan.pdf</p>
<p>To access this document, please sign in with your Microsoft 365 credentials.</p>
<a href="#" style="background:#0078d4;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Open in SharePoint</a>
<hr/><p style="font-size:11px;color:#666">Microsoft Corporation, One Microsoft Way, Redmond WA 98052</p>
</td></tr></table>`,
    },
    redFlags: [
      "Sender domain 'sharepoint-cloud-docs.com' — Microsoft uses sharepoint.com",
      "You were not informed about this document sharing through any other channel",
      "Link goes to a fake Microsoft login page to harvest credentials",
      "Real SharePoint notifications come from microsoft.com or sharepointonline.com",
      "Verify by navigating directly to your company's SharePoint site",
    ],
  });

  // ── SMS Templates ────────────────────────────────────────────────────────────

  await upsertTemplate("tmpl-sms-parcel", {
    name: "SMS: Parcel Delivery Failed — Pay Customs Fee (MEDIUM)",
    type: SimulationType.SMS,
    difficulty: SimulationDifficulty.MEDIUM,
    attackTactic: "urgency",
    payload: {
      sender: "+447700900182",
      sms_text: "Royal Mail: Your parcel (RMG-7834921) could not be delivered. A customs fee of £1.99 is required to release it. Pay now: https://rmpost-uk.com/pay or item will be returned to sender within 24 hours.",
    },
    redFlags: [
      "Domain 'rmpost-uk.com' is not the official Royal Mail domain (royalmail.com)",
      "Royal Mail does not request payment via SMS text message links",
      "£1.99 is a small amount designed to reduce hesitation — once submitted, card details are stolen",
      "Artificial 24-hour urgency to prevent verification",
      "Check parcel status by visiting royalmail.com directly and entering your tracking number",
    ],
  });

  await upsertTemplate("tmpl-sms-bank", {
    name: "SMS: Bank Fraud Alert — Urgent Verification (HARD)",
    type: SimulationType.SMS,
    difficulty: SimulationDifficulty.HARD,
    attackTactic: "authority",
    payload: {
      sender: "NatWest",
      sms_text: "NATWEST FRAUD ALERT: Unusual transaction of £847.00 detected on your account. If not authorised, call 0800-158-1234 IMMEDIATELY to freeze your card. Ref: FRD-29471.",
    },
    redFlags: [
      "The phone number in the message (0800-158-1234) is not NatWest's real number — verify on the back of your card or at natwest.com",
      "Caller ID can be spoofed — even 'NatWest' as a sender name can be faked",
      "Calling the number in the message connects you to a fraudster, not your bank",
      "Your bank's real fraud number is printed on the back of your debit/credit card",
      "Real bank fraud teams will NOT ask for your full PIN, card number, or online banking password",
    ],
  });

  // ── LOGIN PAGE Templates ─────────────────────────────────────────────────────

  await upsertTemplate("tmpl-login-microsoft", {
    name: "Fake Microsoft 365 Login Page (MEDIUM)",
    type: SimulationType.LOGIN_PAGE,
    difficulty: SimulationDifficulty.MEDIUM,
    attackTactic: "credential_harvest",
    payload: {
      brand: "Microsoft 365",
      loginUrl: "https://microsoft365-signin.com/login",
      lookalikeDomain: "microsoft365-signin.com",
      pageTitle: "Sign in to Microsoft 365",
      description: "A pixel-perfect clone of the Microsoft 365 login page hosted on a lookalike domain.",
    },
    redFlags: [
      "Real Microsoft login is always at login.microsoftonline.com or login.microsoft.com",
      "Domain 'microsoft365-signin.com' is not owned by Microsoft",
      "Check the URL in your browser's address bar before entering credentials",
      "Microsoft will never send you a link that goes to a non-microsoft.com domain for login",
      "Enable MFA — even if credentials are stolen, MFA prevents access",
    ],
  });

  await upsertTemplate("tmpl-login-vpn", {
    name: "Fake Corporate VPN Login Page (HARD)",
    type: SimulationType.LOGIN_PAGE,
    difficulty: SimulationDifficulty.HARD,
    attackTactic: "credential_harvest",
    payload: {
      brand: "Corporate VPN Portal",
      loginUrl: "https://vpn-company-remote.com/login",
      lookalikeDomain: "vpn-company-remote.com",
      pageTitle: "Employee VPN — Remote Access Portal",
      description: "A convincing clone of the company's VPN portal served from a lookalike domain, often reached via a phishing email.",
    },
    redFlags: [
      "The VPN portal URL should be bookmarked — never access it via an emailed link",
      "Check the domain carefully in the address bar before entering credentials",
      "A stolen VPN credential gives an attacker full network access",
      "Real VPN portals are hosted on your company's own domain",
      "Enable certificate pinning or MFA on VPN — both are standard and will flag this fake",
    ],
  });

  // ── TEAMS MESSAGE Templates ──────────────────────────────────────────────────

  await upsertTemplate("tmpl-teams-it-helpdesk", {
    name: "Teams: IT Helpdesk Requests Remote Access (EASY)",
    type: SimulationType.TEAMS_MESSAGE,
    difficulty: SimulationDifficulty.EASY,
    attackTactic: "urgency",
    payload: {
      senderName: "IT Helpdesk",
      senderTitle: "Information Technology",
      message: "Hi, I'm from IT. We've detected some unusual network activity from your device and need to run a quick diagnostic. Can you install this remote access tool so I can check your machine? It will only take 5 minutes. Link: https://remote-support-tool.com/install",
    },
    redFlags: [
      "Legitimate IT remote support uses company-approved tools (e.g., TeamViewer configured by IT), not external links",
      "IT would raise a ticket or contact you through official channels before initiating remote access",
      "Verify by hanging up and calling the IT helpdesk directly using your company directory",
      "The external link 'remote-support-tool.com' is not a company-managed resource",
      "Installing unknown remote access tools gives full control of your device to the attacker",
    ],
  });

  await upsertTemplate("tmpl-teams-ceo", {
    name: "Teams: CEO Requests Urgent Gift Card Purchase (HARD)",
    type: SimulationType.TEAMS_MESSAGE,
    difficulty: SimulationDifficulty.HARD,
    attackTactic: "authority",
    payload: {
      senderName: "Richard Hammond",
      senderTitle: "Chief Executive Officer",
      message: "Hi, I need a quick favour. I'm in a board meeting and can't take calls. I need you to purchase 5x £200 Amazon gift cards for a client appreciation event today. Please scratch off the codes and send me photos ASAP. I'll reimburse you through expenses. Please don't mention this to anyone yet — it's a surprise.",
    },
    redFlags: [
      "CEOs do not ask employees to purchase gift cards via Teams messages",
      "Gift card requests are a classic social engineering tactic — gift cards are untraceable and irreversible",
      "'Don't mention to anyone' isolates you and prevents verification",
      "'Can't take calls' prevents verbal verification — a standard social engineering tactic",
      "Verify by calling the CEO's direct line or using a secondary channel before taking any action",
    ],
  });

  console.log("✅ Simulation templates (12 templates across EMAIL, SMS, LOGIN_PAGE, TEAMS_MESSAGE)");

  // ── Security Tips ────────────────────────────────────────────────────────────
  const tips = [
    { title: "Hover before you click", body: "On desktop, hover your cursor over any link before clicking. The real destination appears at the bottom of your browser. If it doesn't match the visible text — don't click.", category: "phishing" },
    { title: "Use a password manager", body: "A password manager generates and stores unique strong passwords for every account. You only need to remember one master passphrase. Bitwarden is free and open-source.", category: "password" },
    { title: "Lock your screen every time", body: "Press Win+L (Windows) or Cmd+Ctrl+Q (Mac) whenever you step away from your desk — even for 30 seconds. It takes less time than your coffee break to unlock.", category: "physical" },
    { title: "Enable MFA on everything", body: "Multi-factor authentication stops 99.9% of account compromise attacks even if your password is stolen. Enable it on email, banking, and your password manager first.", category: "password" },
    { title: "Report phishing — even if you didn't click", body: "Reporting a phishing email you didn't interact with helps your security team protect colleagues who may also receive it. Use the 'Report Phishing' button in your email client.", category: "phishing" },
    { title: "Think before you scan a QR code", body: "QR codes are links in disguise. In unexpected contexts — stickers on public surfaces, unsolicited emails — they often lead to phishing sites. Check the URL before proceeding.", category: "phishing" },
    { title: "Public WiFi + VPN = Safe", body: "Public WiFi in cafés, hotels, and airports can be monitored or spoofed. Always connect to the company VPN before accessing work systems on public networks.", category: "mobile" },
    { title: "Never share passwords — including with IT", body: "Your IT team does not need your password. They can reset it without knowing it. Requests for your password — by email, phone, or Teams — are social engineering attempts.", category: "password" },
    { title: "Verify unusual requests through a second channel", body: "Got a request that seems unusual — especially involving money, credentials, or sensitive data? Verify it by calling the requester on a number you look up yourself, not one from the message.", category: "phishing" },
    { title: "Keep software updated", body: "Software updates often contain critical security patches. Enable automatic updates for your OS, browser, and apps. Attackers exploit known vulnerabilities within hours of publication.", category: "general" },
  ];

  for (const tip of tips) {
    const existing = await db.securityTip.findFirst({ where: { title: tip.title } });
    if (!existing) {
      await db.securityTip.create({ data: tip });
    }
  }
  console.log("✅ Security tips (10 tips)");

  console.log("\n🎉 Seeding complete!\n");
  console.log("Demo accounts:");
  console.log("  Admin:   admin@cybershield.local     / ChangeMe!2026");
  console.log("  Manager: manager@cybershield.local   / Manager!2026");
  console.log("  Employee: alice.chen@cybershield.local / Employee!2026");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
