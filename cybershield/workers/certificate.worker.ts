import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";
import { generateCertificatePdf } from "../src/lib/certificate";

export const certificateWorker = new Worker(
  "certificates",
  async (job) => {
    const { attemptId } = job.data as { attemptId: string };
    const pdfPath = await generateCertificatePdf(attemptId);
    const attempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
    if (attempt) {
      await db.notification.create({
        data: {
          userId: attempt.userId, kind: "CERT_ISSUED",
          title: "Certificate issued",
          body: "Your certificate of completion is ready to download.",
          url: "/employee/certificates",
        },
      });
    }
    console.log(`[certificates] Generated ${pdfPath}`);
    return { pdfPath };
  },
  { connection: redis }
);

certificateWorker.on("failed", (job, err) => console.error("[certificates] failed:", job?.name, err));
