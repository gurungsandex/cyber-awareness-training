import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";

export const simulationWorker = new Worker(
  "simulations",
  async (job) => {
    if (job.name === "launch") {
      const { campaignId } = job.data as { campaignId: string };
      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
        include: { template: true, targets: true },
      });
      if (!campaign) return { skipped: true };
      if (campaign.status === "CANCELLED") return { cancelled: true };

      const userSets = await Promise.all(
        campaign.targets.map((t) =>
          db.user.findMany({
            where: {
              deletedAt: null,
              tenantId: campaign.tenantId,
              ...(t.allUsers ? {} : { ...(t.departmentId ? { departmentId: t.departmentId } : {}), ...(t.role ? { role: t.role } : {}) }),
            },
            select: { id: true },
          })
        )
      );
      const userIds = [...new Set(userSets.flat().map((u) => u.id))];

      const payload = campaign.template.payload as { sender?: string; senderName?: string; subject?: string; body?: string };
      if (userIds.length > 0) {
        await db.simulatedInboxItem.createMany({
          data: userIds.map((userId) => ({
            userId,
            campaignId: campaign.id,
            subject: payload.subject ?? "(no subject)",
            senderName: payload.senderName ?? "Unknown Sender",
            senderEmail: payload.sender ?? "unknown@example.com",
            body: payload.body ?? "",
            isPhishing: true,
          })),
        });
      }

      await db.campaign.update({
        where: { id: campaignId },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      console.log(`[simulations] Launched campaign ${campaign.name} -> ${userIds.length} targeted users`);
      return { launched: true, targeted: userIds.length };
    }
  },
  { connection: redis }
);

simulationWorker.on("failed", (job, err) => console.error("[simulations] failed:", job?.name, err));
