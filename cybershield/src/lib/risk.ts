import { db } from "./db";

/**
 * Risk score is a 0–100 measure of an individual's security risk. It rises when
 * a user falls for a simulation or fails an assessment, and eases as they report
 * phishing and complete training. All adjustments are clamped to [0, 100].
 */
export const RISK_DELTAS = {
  CLICKED_SIMULATION: 15, // fell for a phishing link
  SUBMITTED_CREDENTIALS: 25, // entered credentials on a fake login page
  FAILED_ASSESSMENT: 10,
  REPORTED_SIMULATION: -8, // correctly reported a phish
  PASSED_ASSESSMENT: -5,
} as const;

/** Clamp any number into the valid risk-score range [0, 100]. */
export function clampRisk(n: number) {
  return Math.max(0, Math.min(100, n));
}

/** Pure helper: the new risk score after applying a delta to a current score. */
export function nextRiskScore(current: number, delta: number) {
  return clampRisk(current + delta);
}

/**
 * Apply a bounded delta to a user's risk score. Never throws — a failure to
 * update the risk score must not break the user-facing action that triggered it.
 */
export async function adjustRiskScore(userId: string, delta: number): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { riskScore: true } });
    if (!user) return;
    const next = nextRiskScore(user.riskScore, delta);
    if (next === user.riskScore) return;
    await db.user.update({ where: { id: userId }, data: { riskScore: next } });
  } catch {
    // non-fatal
  }
}
