import { describe, it, expect } from "vitest";
import { loginSchema, submitAssessmentSchema, createCampaignSchema, createUserSchema } from "./validations";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
  });
});

describe("submitAssessmentSchema", () => {
  it("accepts a well-formed answer array", () => {
    const result = submitAssessmentSchema.safeParse({
      answers: [{ questionId: "q1", selectedOptionId: "o1" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an answer missing selectedOptionId", () => {
    const result = submitAssessmentSchema.safeParse({
      answers: [{ questionId: "q1" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty answers array", () => {
    expect(submitAssessmentSchema.safeParse({ answers: [] }).success).toBe(true);
  });
});

describe("createCampaignSchema", () => {
  const base = {
    name: "Q1 Phish Test",
    templateId: "tpl1",
    scheduledAt: new Date().toISOString(),
    targets: [{ allUsers: true }],
  };

  it("accepts a valid campaign payload", () => {
    expect(createCampaignSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createCampaignSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects a non-ISO scheduledAt", () => {
    expect(createCampaignSchema.safeParse({ ...base, scheduledAt: "next tuesday" }).success).toBe(false);
  });

  it("rejects an invalid target role", () => {
    expect(
      createCampaignSchema.safeParse({ ...base, targets: [{ role: "SUPERADMIN" }] }).success
    ).toBe(false);
  });
});

describe("createUserSchema", () => {
  it("accepts a valid user payload and defaults role to EMPLOYEE", () => {
    const result = createUserSchema.safeParse({
      email: "user@example.com",
      name: "User One",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("EMPLOYEE");
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = createUserSchema.safeParse({
      email: "user@example.com",
      name: "User One",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid role", () => {
    const result = createUserSchema.safeParse({
      email: "user@example.com",
      name: "User One",
      password: "password123",
      role: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });
});
