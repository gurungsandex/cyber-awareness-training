import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({ name: z.string().min(1).max(80), description: z.string().max(200).optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const dept = await db.department.update({
      where: { id: params.id },
      data: { name: parsed.data.name, description: parsed.data.description },
    });
    return NextResponse.json(dept);
  } catch {
    return NextResponse.json({ error: "Not found or name conflict" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const memberCount = await db.user.count({ where: { departmentId: params.id, deletedAt: null } });
  if (memberCount > 0)
    return NextResponse.json({ error: `Cannot delete — ${memberCount} employee(s) still assigned to this department.` }, { status: 409 });

  await db.department.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
