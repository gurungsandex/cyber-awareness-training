import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";

export const remediationWorker = new Worker(
  "remediation",
  async (job) => {
    const { userId, trigger } = job.data as { userId: string; trigger: string };

    // Find mandatory remediation courses (using isMandatory + the seeded phishing course as fallback)
    const remediationCourse = await db.course.findFirst({
      where: { isMandatory: true, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
    });
    if (!remediationCourse) return { skipped: "no_course" };

    const due = new Date(); due.setDate(due.getDate() + 7);
    const enrollment = await db.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: remediationCourse.id } },
      update: { status: "ENROLLED", dueAt: due, isRemediation: true },
      create: { userId, courseId: remediationCourse.id, status: "ENROLLED", dueAt: due, isRemediation: true },
    });

    await db.notification.create({
      data: {
        userId, kind: "SIM_REMEDIATION",
        title: "Remediation training assigned",
        body: `Following a recent simulation, you've been enrolled in "${remediationCourse.title}". Please complete it within 7 days.`,
        link: `/employee/courses/${remediationCourse.id}`,
      },
    });

    console.log(`[remediation] Enrolled user ${userId} in ${remediationCourse.title} (trigger: ${trigger})`);
    return { enrollmentId: enrollment.id };
  },
  { connection: redis }
);

remediationWorker.on("failed", (job, err) => console.error("[remediation] failed:", job?.name, err));
