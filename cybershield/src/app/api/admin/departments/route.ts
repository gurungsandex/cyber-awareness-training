import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({ name: z.string().min(1).max(80), description: z.string().max(200).optional() });

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId ?? null;
  const departments = await db.department.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(departments);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tenantId = (session.user as any).tenantId ?? null;

  try {
    const dept = await db.department.create({
      data: { name: parsed.data.name, description: parsed.data.description, tenantId },
    });
    return NextResponse.json(dept, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Department name already exists" }, { status: 409 });
  }
}
