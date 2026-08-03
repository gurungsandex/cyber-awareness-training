import { NextResponse } from "next/server";
import { auth } from "./auth";
import { db } from "./db";
import { ZodError } from "zod";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return bad("Unauthorized", 401);
  return { user: session.user };
}

export async function requireRole(role: "ADMIN" | "MANAGER") {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;
  const allowed = role === "ADMIN" ? ["ADMIN"] : ["ADMIN", "MANAGER"];
  if (!allowed.includes((ctx.user as any).role)) return bad("Forbidden", 403);
  return ctx;
}

/**
 * Tenant-scoping filter for tenant-owned models (User, Department, Campaign, …).
 * Matches the caller's own tenant, including the legacy `null` tenant for
 * deployments that predate tenant assignment. Shared content (courses,
 * templates) and per-user data (enrollments, notifications — already bounded by
 * userId) are intentionally not scoped through this.
 */
export function tenantWhere(user: { tenantId?: string | null }) {
  return { tenantId: user.tenantId ?? null };
}

export function handleZodError(e: unknown) {
  if (e instanceof ZodError) {
    return bad(e.errors.map((x) => x.message).join(", "));
  }
  // A malformed / empty JSON body surfaces as a SyntaxError from req.json().
  // That's a client error (400), not a server fault — don't return a 500 with a
  // stack for it.
  if (e instanceof SyntaxError) {
    return bad("Invalid JSON body");
  }
  console.error(e);
  return bad("Internal server error", 500);
}

export async function audit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: object
) {
  try {
    await db.auditLog.create({
      data: { userId, action, entity, entityId, metadata: metadata as any },
    });
  } catch {
    // non-fatal
  }
}
