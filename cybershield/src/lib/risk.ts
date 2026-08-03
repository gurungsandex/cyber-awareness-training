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
 *
 * The update is performed as a single atomic, clamped SQL statement rather than
 * a read-modify-write. Two interactions landing at the same time (e.g. a click
 * and a report processed concurrently) would otherwise both read the same
 * starting score and the second write would clobber the first — a classic
 * lost-update race. Computing the clamped value inside the UPDATE removes it.
 */
export async function adjustRiskScore(userId: string, delta: number): Promise<void> {
  try {
    await db.$executeRaw`
      UPDATE "User"
      SET "riskScore" = GREATEST(0, LEAST(100, "riskScore" + ${delta})),
          "updatedAt" = NOW()
      WHERE "id" = ${userId}
    `;
  } catch {
    // non-fatal
  }
}
