import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let tenantId: unknown;
  try {
    ({ tenantId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!tenantId || typeof tenantId !== "string")
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const token = randomBytes(24).toString("hex");

  try {
    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: { registrationToken: token },
      select: { registrationToken: true },
    });
    return NextResponse.json({ token: tenant.registrationToken });
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
}
