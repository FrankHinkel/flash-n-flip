import { z } from "zod";

export const accountPasswordSchema = z.string().min(12).max(128);

const recoveryCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const recoveryCodePattern = new RegExp(`^[${recoveryCodeAlphabet}]{12}$`);

export const normalizePasswordRecoveryCode = (value: string): string =>
  value.trim().replaceAll(/[-\s]/g, "").toUpperCase();

export const passwordRecoveryCodeSchema = z
  .string()
  .transform(normalizePasswordRecoveryCode)
  .pipe(z.string().regex(recoveryCodePattern));

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: accountPasswordSchema,
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  recoveryCode: passwordRecoveryCodeSchema,
  newPassword: accountPasswordSchema,
  deviceName: z.string().trim().min(1).max(100),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
