import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export const submitAssessmentSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionId: z.string(),
    })
  ),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  templateId: z.string(),
  scheduledAt: z.string().datetime(),
  targets: z.array(
    z.object({
      departmentId: z.string().optional(),
      role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
      allUsers: z.boolean().optional(),
    })
  ),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
  departmentId: z.string().optional(),
});
