import { redis } from "./redis";

/**
 * Redis-backed login throttle. A fixed window counts recent failed attempts per
 * identifier (email); once the threshold is reached, further attempts are
 * rejected until the window expires. Successful logins reset the counter.
 *
 * Every operation FAILS OPEN: if Redis is unreachable we never block a login —
 * an outage must not lock everyone out. Because it keys on email it can be used
 * to slow a targeted account; pair it with IP-based limiting at the proxy (see
 * docker/nginx.conf) for brute-force protection that can't cause lockout.
 *
 * This module must only be imported dynamically from the Node runtime (it pulls
 * in ioredis) — never statically into the Edge middleware bundle.
 */
const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 10;

function key(identifier: string) {
  return `login:fail:${identifier.trim().toLowerCase()}`;
}

export async function isLoginRateLimited(identifier: string): Promise<boolean> {
  try {
    const count = await redis.get(key(identifier));
    return count !== null && Number(count) >= MAX_FAILURES;
  } catch {
    return false;
  }
}

export async function recordLoginFailure(identifier: string): Promise<void> {
  try {
    const k = key(identifier);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, WINDOW_SECONDS);
  } catch {
    // fail open
  }
}

export async function clearLoginFailures(identifier: string): Promise<void> {
  try {
    await redis.del(key(identifier));
  } catch {
    // non-fatal
  }
}
