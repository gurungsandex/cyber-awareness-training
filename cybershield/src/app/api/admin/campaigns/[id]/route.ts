import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  visibleToManagers: z.boolean().optional(),
  // Only real CampaignStatus values are accepted — an arbitrary string would
  // otherwise be passed straight to Prisma and blow up with an unhandled 500.
  status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const updated = await db.campaign.update({
      where: { id: params.id },
      data: {
        ...(body.visibleToManagers !== undefined && { visibleToManagers: body.visibleToManagers }),
        ...(body.status && { status: body.status }),
      },
      select: { id: true, visibleToManagers: true, status: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
}
