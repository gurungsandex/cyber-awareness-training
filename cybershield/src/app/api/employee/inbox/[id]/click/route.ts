import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { remediationQueue } from "@/lib/queues";
import { adjustRiskScore, RISK_DELTAS } from "@/lib/risk";

/**
 * The employee "fell for" the simulated phish by clicking its link. This is the
 * failure path: we record the interaction, raise their risk score, and enqueue
 * remediation training. No real credentials are ever collected.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id!;

  const item = await db.simulatedInboxItem.findFirst({ where: { id: params.id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reporting wins: if the user already reported this as phishing, don't penalise.
  if (item.reportedAt) {
    return NextResponse.json({ ok: true, alreadyReported: true });
  }

  // Idempotent: only score/remediate the first click.
  if (!item.clickedAt) {
    await db.simulatedInboxItem.update({
      where: { id: params.id },
      data: { clickedAt: new Date(), isRead: true, openedAt: item.openedAt ?? new Date() },
    });

    await db.simulationInteraction.create({
      data: {
        campaignId: item.campaignId,
        userId,
        action: "CLICKED_LINK",
        metadata: { source: "simulated_inbox" },
      },
    });

    await adjustRiskScore(userId, RISK_DELTAS.CLICKED_SIMULATION);
    await remediationQueue.add("enroll", { userId, trigger: "CLICKED_SIMULATION" }).catch(() => {});
  }

  return NextResponse.json({ ok: true, failed: true });
}
