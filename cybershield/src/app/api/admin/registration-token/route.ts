import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { tenantId } = await req.json();
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const token = randomBytes(24).toString("hex");

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { registrationToken: token },
    select: { registrationToken: true },
  });

  return NextResponse.json({ token: tenant.registrationToken });
}
