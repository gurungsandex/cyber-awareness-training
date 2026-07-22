import { test } from "node:test";
import assert from "node:assert/strict";
import { clampRisk, nextRiskScore, RISK_DELTAS } from "../src/lib/risk";

test("clampRisk keeps values within [0, 100]", () => {
  assert.equal(clampRisk(-20), 0);
  assert.equal(clampRisk(0), 0);
  assert.equal(clampRisk(55), 55);
  assert.equal(clampRisk(100), 100);
  assert.equal(clampRisk(140), 100);
});

test("nextRiskScore never drops below 0", () => {
  assert.equal(nextRiskScore(5, RISK_DELTAS.REPORTED_SIMULATION), 0);
  assert.equal(nextRiskScore(0, RISK_DELTAS.PASSED_ASSESSMENT), 0);
});

test("nextRiskScore never exceeds 100", () => {
  assert.equal(nextRiskScore(95, RISK_DELTAS.SUBMITTED_CREDENTIALS), 100);
  assert.equal(nextRiskScore(90, RISK_DELTAS.CLICKED_SIMULATION), 100);
});

test("clicking a simulation raises risk, reporting lowers it", () => {
  const afterClick = nextRiskScore(40, RISK_DELTAS.CLICKED_SIMULATION);
  assert.equal(afterClick, 55);
  const afterReport = nextRiskScore(afterClick, RISK_DELTAS.REPORTED_SIMULATION);
  assert.equal(afterReport, 47);
});
