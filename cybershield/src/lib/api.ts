import { NextResponse } from "next/server";
import { auth } from "./auth";
import { db } from "./db";
import { ZodError } from "zod";
import { logger } from "./logger";

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

export function handleZodError(e: unknown) {
  if (e instanceof ZodError) {
    return bad(e.errors.map((x) => x.message).join(", "));
  }
  logger.error("Unhandled API error", e);
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
  } catch (e) {
    logger.error("Failed to write audit log entry", e, { userId, action, entity, entityId });
  }
}
