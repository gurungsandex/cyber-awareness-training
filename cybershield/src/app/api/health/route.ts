import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

// Never cache the health check — it must reflect live state.
export const dynamic = "force-dynamic";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Liveness/readiness probe. The database is the hard dependency: if it is
 * unreachable the app cannot serve, so we return 503. Redis powers background
 * jobs only — the web tier still works without it — so a Redis failure is
 * reported as "degraded" but does not fail the probe. No internal error detail
 * is leaked to the caller.
 */
export async function GET() {
  let dbOk = false;
  let redisOk = false;

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 2000);
    dbOk = true;
  } catch (e) {
    logger.error("health: database check failed", { error: (e as Error).message });
  }

  try {
    await withTimeout(redis.ping(), 2000);
    redisOk = true;
  } catch (e) {
    logger.warn("health: redis check failed", { error: (e as Error).message });
  }

  const status = dbOk ? (redisOk ? "healthy" : "degraded") : "unhealthy";
  const body = {
    status,
    checks: { database: dbOk ? "up" : "down", redis: redisOk ? "up" : "down" },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
