import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/api";

export const PATCH = withApiErrorHandling(async (req: Request, { params }: { params: { id: string } }) => {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId ?? null;
  const existing = await db.campaign.findUnique({ where: { id: params.id } });
  if (!existing || (tenantId && existing.tenantId !== tenantId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedStatuses = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"];
  const body = await req.json();
  if (body.status && !allowedStatuses.includes(body.status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const updated = await db.campaign.update({
    where: { id: params.id },
    data: {
      ...(typeof body.visibleToManagers === "boolean" && { visibleToManagers: body.visibleToManagers }),
      ...(body.status && { status: body.status }),
    },
    select: { id: true, visibleToManagers: true, status: true },
  });
  return NextResponse.json(updated);
});
