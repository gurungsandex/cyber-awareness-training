import { NextRequest } from "next/server";
import { ok, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { createCampaignSchema } from "@/lib/validations";
import { simulationQueue } from "@/lib/queues";

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;
  const campaigns = await db.campaign.findMany({
    where: tenantId ? { tenantId } : {},
    include: { template: true, _count: { select: { interactions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(campaigns);
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const tenantId = (ctx.user as any).tenantId ?? null;
  try {
    const body = createCampaignSchema.parse(await req.json());
    const campaign = await db.campaign.create({
      data: {
        name: body.name,
        templateId: body.templateId,
        scheduledAt: new Date(body.scheduledAt),
        tenantId,
        targets: { create: body.targets },
      },
    });
    // Schedule the simulation job
    const delay = Math.max(0, new Date(body.scheduledAt).getTime() - Date.now());
    await simulationQueue.add("launch", { campaignId: campaign.id }, { delay }).catch(() => {});
    await audit(ctx.user.id, "CAMPAIGN_CREATE", "Campaign", campaign.id);
    return ok(campaign, 201);
  } catch (e) {
    return handleZodError(e);
  }
}
