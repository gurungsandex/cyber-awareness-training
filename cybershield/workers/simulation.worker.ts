import { Worker } from "bullmq";
import { redis } from "../src/lib/redis";
import { db } from "../src/lib/db";
import type { Prisma, Role } from "@prisma/client";

/**
 * Resolve a campaign's targets (all-users / role / department) into a distinct
 * set of active users belonging to the campaign's tenant.
 */
async function resolveTargetedUsers(campaignId: string, tenantId: string | null) {
  const targets = await db.campaignTarget.findMany({ where: { campaignId } });
  if (targets.length === 0) return [];

  // Scope to the campaign's tenant. Legacy unscoped users (tenantId null) are
  // only included when the campaign itself is unscoped.
  const baseWhere: Prisma.UserWhereInput = { deletedAt: null, tenantId: tenantId ?? null };

  // An "all users" target matches everyone in the tenant — no OR filter needed.
  // (An empty object inside a Prisma `OR` array does NOT mean "match all", so we
  // must branch here rather than push `{}` into the OR list.)
  if (targets.some((t) => t.allUsers)) {
    return db.user.findMany({ where: baseWhere, select: { id: true } });
  }

  const orClauses: Prisma.UserWhereInput[] = [];
  for (const t of targets) {
    if (t.departmentId) {
      orClauses.push({ departmentId: t.departmentId });
    } else if (t.role) {
      orClauses.push({ role: t.role as Role });
    }
  }
  if (orClauses.length === 0) return [];

  return db.user.findMany({
    where: { ...baseWhere, OR: orClauses },
    select: { id: true },
  });
}

export const simulationWorker = new Worker(
  "simulations",
  async (job) => {
    if (job.name !== "launch") return;

    const { campaignId } = job.data as { campaignId: string };
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });
    if (!campaign) return { skipped: true };
    if (campaign.status === "CANCELLED") return { cancelled: true };
    // Idempotency: don't re-deliver a campaign that already ran.
    if (campaign.status === "RUNNING" || campaign.status === "COMPLETED") {
      return { alreadyLaunched: true };
    }

    const users = await resolveTargetedUsers(campaignId, campaign.tenantId);

    const payload = (campaign.template.payload ?? {}) as {
      sender?: string;
      senderEmail?: string;
      senderName?: string;
      subject?: string;
      body?: string;
    };
    const senderEmail = payload.senderEmail || payload.sender || "no-reply@simulated.local";
    const senderName = payload.senderName || campaign.template.name;
    const subject = payload.subject || "(no subject)";
    const body = payload.body || "";

    // Deliver one simulated inbox item per targeted user. Skip users who already
    // have an item for this campaign so re-runs never duplicate.
    let delivered = 0;
    for (const u of users) {
      const existing = await db.simulatedInboxItem.findFirst({
        where: { userId: u.id, campaignId },
        select: { id: true },
      });
      if (existing) continue;

      await db.simulatedInboxItem.create({
        data: {
          userId: u.id,
          campaignId,
          subject,
          senderName,
          senderEmail,
          body,
          isPhishing: true,
        },
      });
      delivered++;
    }

    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    console.log(`[simulations] Launched "${campaign.name}" — delivered ${delivered} inbox item(s) to ${users.length} user(s)`);
    return { launched: true, delivered, targeted: users.length };
  },
  { connection: redis }
);

simulationWorker.on("failed", (job, err) => console.error("[simulations] failed:", job?.name, err));
