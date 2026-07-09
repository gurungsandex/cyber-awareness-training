import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/api";

export const POST = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id!;

  const item = await db.simulatedInboxItem.findFirst({ where: { id: params.id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return NextResponse.json({ ok: true });
});
