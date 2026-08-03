import { NextRequest } from "next/server";
import { ok, bad, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  const departments = await db.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return ok({ departments });
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch (e) {
    return handleZodError(e);
  }

  const existing = await db.department.findFirst({ where: { name: body.name, tenantId: null } });
  if (existing) return bad("A group with this name already exists.");

  const dept = await db.department.create({
    data: { name: body.name, description: body.description },
  });

  await audit(ctx.user.id, "GROUP_CREATE", "Department", dept.id, { name: body.name });
  return ok({ department: dept });
}
