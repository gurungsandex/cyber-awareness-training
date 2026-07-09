import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { withApiErrorHandling } from "@/lib/api";

export const POST = withApiErrorHandling(async (req: Request) => {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminTenantId = (session.user as any).tenantId ?? null;
  const body = await req.json().catch(() => ({}));
  const tenantId = adminTenantId ?? body.tenantId;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  if (adminTenantId && body.tenantId && body.tenantId !== adminTenantId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = randomBytes(32).toString("hex");

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { registrationToken: token },
    select: { registrationToken: true },
  });

  return NextResponse.json({ token: tenant.registrationToken });
});
