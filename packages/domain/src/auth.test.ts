import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  normalizePasswordRecoveryCode,
  resetPasswordSchema,
} from "./auth";

describe("account password contracts", () => {
  it("normalizes a readable recovery code", () => {
    expect(normalizePasswordRecoveryCode("abcd-efgh-jkmn")).toBe(
      "ABCDEFGHJKMN",
    );
    expect(
      resetPasswordSchema.parse({
        email: " Learner@Example.org ",
        recoveryCode: "abcd efgh jkmn",
        newPassword: "a-new-password-123",
        deviceName: "iPhone",
      }),
    ).toMatchObject({
      email: "learner@example.org",
      recoveryCode: "ABCDEFGHJKMN",
    });
  });

  it("rejects short passwords and ambiguous recovery-code characters", () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: "current-password",
        newPassword: "too-short",
      }),
    ).toThrow();
    expect(() =>
      resetPasswordSchema.parse({
        email: "learner@example.org",
        recoveryCode: "ABCD-EFGH-10IO",
        newPassword: "a-new-password-123",
        deviceName: "iPhone",
      }),
    ).toThrow();
  });
});
