import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";

export const simulationWorker = new Worker(
  "simulations",
  async (job) => {
    if (job.name === "launch") {
      const { campaignId } = job.data as { campaignId: string };
      const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) return { skipped: true };
      if (campaign.status === "CANCELLED") return { cancelled: true };
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      console.log(`[simulations] Launched campaign ${campaign.name}`);
      return { launched: true };
    }
  },
  { connection: redis }
);

simulationWorker.on("failed", (job, err) => console.error("[simulations] failed:", job?.name, err));
