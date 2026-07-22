import { NextRequest } from "next/server";
import { ok, bad, requireRole, handleZodError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { createUserSchema } from "@/lib/validations";
import { newHireQueue } from "@/lib/queues";
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

    // Reject duplicate emails with a clear 409 rather than a raw Prisma error.
    const existing = await db.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) return bad("A user with this email already exists", 409);

    // Scope new users to the creating admin's tenant so tenant-scoped campaigns
    // and training reach them.
    const creator = await db.user.findUnique({ where: { id: ctx.user.id }, select: { tenantId: true } });

    const hash = await bcrypt.hash(body.password, 12);
    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: hash,
        role: body.role,
        departmentId: body.departmentId,
        tenantId: creator?.tenantId ?? null,
      },
    });

    // Employees onboarded by an admin get the same mandatory-course enrolment.
    if (user.role === "EMPLOYEE") {
      await newHireQueue.add("enroll", { userId: user.id }).catch(() => {});
    }

    await audit(ctx.user.id, "USER_CREATE", "User", user.id);
    return ok({ id: user.id, email: user.email, name: user.name, role: user.role }, 201);
  } catch (e) {
    return handleZodError(e);
  }
}
