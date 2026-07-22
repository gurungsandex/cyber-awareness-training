import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { adjustRiskScore, RISK_DELTAS } from "@/lib/risk";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id!;

  const item = await db.simulatedInboxItem.findFirst({ where: { id: params.id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: only credit the first report for this item.
  if (item.reportedAt) return NextResponse.json({ ok: true, alreadyReported: true });

  await db.simulatedInboxItem.update({
    where: { id: params.id },
    data: { reportedAt: new Date() },
  });

  // Record interaction
  await db.simulationInteraction.create({
    data: {
      campaignId: item.campaignId,
      userId,
      action: "REPORTED",
      metadata: { source: "simulated_inbox" },
    },
  });

  // Reporting a phish is good security behaviour — ease the user's risk score.
  await adjustRiskScore(userId, RISK_DELTAS.REPORTED_SIMULATION);

  return NextResponse.json({ ok: true });
}
