import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { newHireQueue } from "@/lib/queues";

const schema = z.object({
  name:        z.string().min(2).max(100),
  email:       z.string().email(),
  jobTitle:    z.string().min(1).max(100),
  departmentId: z.string().min(1),
  password:    z.string().min(8).max(128),
});

// GET: return tenant name + department list for the registration form
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const tenant = await db.tenant.findUnique({
    where: { registrationToken: params.token },
    select: {
      id: true, name: true,
      departments: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Invalid or expired registration link." }, { status: 404 });
  return NextResponse.json({ tenantId: tenant.id, tenantName: tenant.name, departments: tenant.departments });
}

// POST: create the employee account
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const tenant = await db.tenant.findUnique({
    where: { registrationToken: params.token },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ error: "Invalid or expired registration link." }, { status: 404 });

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, jobTitle, departmentId, password } = parsed.data;

  // Verify department belongs to this tenant (or is a legacy unscoped department)
  const dept = await db.department.findFirst({
    where: { id: departmentId, OR: [{ tenantId: tenant.id }, { tenantId: null }] },
  });
  if (!dept) return NextResponse.json({ error: "Invalid department." }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "EMPLOYEE",
      departmentId,
      tenantId: tenant.id,
      hiredAt: new Date(),
      isNewHire: true,
    },
  });

  // Kick off new-hire onboarding: auto-enrol in mandatory courses + welcome.
  await newHireQueue.add("enroll", { userId: newUser.id }).catch(() => {});

  // Log job title in audit (we store it as a metadata note — jobTitle not in schema as a separate field)
  await db.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: "SELF_REGISTERED",
      entity: "User",
      metadata: { email, name, jobTitle, departmentId },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
