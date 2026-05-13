import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";

export const newHireWorker = new Worker(
  "newhire",
  async (job) => {
    const { userId } = job.data as { userId: string };
    const mandatory = await db.course.findMany({ where: { isMandatory: true, status: "PUBLISHED" } });
    const due = new Date(); due.setDate(due.getDate() + 14);

    for (const c of mandatory) {
      await db.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: c.id } },
        update: {}, create: { userId, courseId: c.id, status: "ENROLLED", dueAt: due },
      });
    }

    await db.notification.create({
      data: {
        userId, kind: "NEW_HIRE_WELCOME",
        title: "Welcome to CyberShield",
        body: `You've been enrolled in ${mandatory.length} mandatory course(s). Please complete them within 14 days.`,
        url: "/employee/courses",
      },
    });
    console.log(`[newhire] Enrolled user ${userId} in ${mandatory.length} courses`);
    return { count: mandatory.length };
  },
  { connection: redis }
);

newHireWorker.on("failed", (job, err) => console.error("[newhire] failed:", job?.name, err));
