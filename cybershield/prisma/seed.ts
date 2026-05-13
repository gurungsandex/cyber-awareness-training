import { PrismaClient, Role, SimulationType, SimulationDifficulty, CourseStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // Departments
  const [it, finance, hr, sales] = await Promise.all([
    db.department.upsert({ where: { name: "IT" }, update: {}, create: { name: "IT", description: "Information Technology" } }),
    db.department.upsert({ where: { name: "Finance" }, update: {}, create: { name: "Finance", description: "Finance & Accounting" } }),
    db.department.upsert({ where: { name: "HR" }, update: {}, create: { name: "HR", description: "Human Resources" } }),
    db.department.upsert({ where: { name: "Sales" }, update: {}, create: { name: "Sales", description: "Sales & Marketing" } }),
  ]);

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@cybershield.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026";
  const adminHash = await bcrypt.hash(adminPassword, 12);
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "Platform Admin", passwordHash: adminHash, role: Role.ADMIN },
  });

  // Manager
  const mgrHash = await bcrypt.hash("Manager!2026", 12);
  await db.user.upsert({
    where: { email: "manager@cybershield.local" },
    update: {},
    create: { email: "manager@cybershield.local", name: "Jane Manager", passwordHash: mgrHash, role: Role.MANAGER, departmentId: it.id },
  });

  // Employees
  const empHash = await bcrypt.hash("Employee!2026", 12);
  for (const [name, deptId] of [
    ["Alice Chen", it.id], ["Bob Smith", finance.id], ["Carol Jones", hr.id],
    ["David Patel", sales.id], ["Eve Müller", it.id],
  ] as const) {
    const email = name.toLowerCase().replace(/\s/g, ".") + "@cybershield.local";
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: empHash, role: Role.EMPLOYEE, departmentId: deptId },
    });
  }

  // Sample course
  const course = await db.course.upsert({
    where: { id: "seed-course-phishing-101" },
    update: {},
    create: {
      id: "seed-course-phishing-101",
      title: "Phishing 101: Spot the Bait",
      description: "Learn to identify phishing emails, SMS scams, and credential harvesting pages.",
      status: CourseStatus.PUBLISHED,
      isMandatory: true,
      passMark: 80,
      estimatedMin: 25,
    },
  });
  const mod = await db.module.upsert({
    where: { id: "seed-mod-1" },
    update: {},
    create: { id: "seed-mod-1", courseId: course.id, title: "The Anatomy of a Phish", orderIndex: 0 },
  });
  await db.lesson.upsert({
    where: { id: "seed-lesson-1" },
    update: {},
    create: {
      id: "seed-lesson-1", moduleId: mod.id, orderIndex: 0, durationMin: 8,
      title: "Red Flags You Can Train Yourself to See",
      content: "# Red Flags\n\n- Urgent tone\n- Mismatched sender domain\n- Generic greeting\n- Suspicious links\n- Unexpected attachments\n",
    },
  });

  // Sample simulation template
  await db.simulationTemplate.upsert({
    where: { id: "seed-tmpl-1" },
    update: {},
    create: {
      id: "seed-tmpl-1",
      name: "IT Password Reset Required",
      type: SimulationType.EMAIL,
      difficulty: SimulationDifficulty.EASY,
      attackTactic: "credential_harvest",
      payload: {
        sender: "it-support@c0mpany.com",
        senderName: "IT Helpdesk",
        subject: "URGENT: Password Reset Required Within 24 Hours",
        body: "<p>Dear user,</p><p>Our records show your password is about to expire. Click below within 24 hours to avoid account lockout.</p><p><a href='#'>Reset Password Now</a></p><p>— IT Helpdesk</p>",
      },
      redFlags: [
        "Sender domain misspelled (c0mpany.com vs company.com)",
        "Urgency pressure with 24-hour deadline",
        "Generic 'Dear user' greeting",
        "Hovering the link would reveal a non-corporate URL",
      ],
    },
  });

  // Security tip
  await db.securityTip.create({
    data: {
      title: "Hover before you click",
      body: "On desktop, hover your cursor over any link before clicking. The real destination appears at the bottom of your browser. If it doesn't match the visible text — don't click.",
      category: "phishing",
    },
  });

  console.log("Seeded successfully.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
