import { NextRequest } from "next/server";
import { ok, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { createUserSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

export async function GET() {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(users.map((u) => ({ ...u, passwordHash: undefined })));
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if ("status" in ctx) return ctx;
  try {
    const body = createUserSchema.parse(await req.json());
    const hash = await bcrypt.hash(body.password, 12);
    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: hash,
        role: body.role,
        departmentId: body.departmentId,
      },
    });
    await audit(ctx.user.id, "USER_CREATE", "User", user.id);
    return ok({ id: user.id, email: user.email, name: user.name, role: user.role }, 201);
  } catch (e) {
    return handleZodError(e);
  }
}
