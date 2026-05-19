import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = await db.campaign.update({
    where: { id: params.id },
    data: {
      ...(typeof body.visibleToManagers === "boolean" && { visibleToManagers: body.visibleToManagers }),
      ...(body.status && { status: body.status }),
    },
    select: { id: true, visibleToManagers: true, status: true },
  });
  return NextResponse.json(updated);
}
