import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  fullName: z.string().min(2).max(191),
  phone: z
    .string()
    .min(8)
    .max(32)
    .regex(/^[0-9+\-\s]+$/)
    .optional()
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
