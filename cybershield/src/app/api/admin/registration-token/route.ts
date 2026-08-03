import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let requestedTenantId: unknown;
  try {
    ({ tenantId: requestedTenantId } = await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // An admin can only mint a registration link for their own tenant. Ignore any
  // tenantId in the body except to reject a mismatch — this closes the
  // cross-tenant token-rotation gap.
  const tenantId = (session.user as any).tenantId ?? null;
  if (!tenantId)
    return NextResponse.json({ error: "Your account is not associated with a tenant" }, { status: 400 });
  if (requestedTenantId && requestedTenantId !== tenantId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
