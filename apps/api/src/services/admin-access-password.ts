import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

type AdminAccessPasswordConfig = {
  configuredPassword?: string;
  passwordFile?: string;
};

const validatePassword = (password: string, source: string): string => {
  const trimmed = password.trim();
  if (trimmed.length < 32) {
    throw new Error(`${source} must contain at least 32 characters`);
  }
  return trimmed;
};

const readPasswordFile = (passwordFile: string): string =>
  validatePassword(
    readFileSync(passwordFile, "utf8"),
    "Admin access password file",
  );

const ensurePrivatePasswordFile = (passwordFile: string): void => {
  const permissions = statSync(passwordFile).mode & 0o777;
  if ((permissions & 0o077) === 0) return;
  chmodSync(passwordFile, 0o600);
};

export const loadAdminAccessPassword = ({
  configuredPassword,
  passwordFile,
}: AdminAccessPasswordConfig): string | null => {
  const direct = configuredPassword?.trim();
  const configuredFile = passwordFile?.trim();
  if (direct && configuredFile) {
    throw new Error(
      "Configure only FNF_ADMIN_ACCESS_PASSWORD or FNF_ADMIN_ACCESS_PASSWORD_FILE",
    );
  }
  if (direct) {
    return validatePassword(direct, "FNF_ADMIN_ACCESS_PASSWORD");
  }
  if (!configuredFile) return null;

  const resolvedFile = resolve(configuredFile);
  try {
    const password = readPasswordFile(resolvedFile);
    ensurePrivatePasswordFile(resolvedFile);
    return password;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  mkdirSync(dirname(resolvedFile), { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString("base64url");
  try {
    writeFileSync(resolvedFile, `${generated}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return generated;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      const password = readPasswordFile(resolvedFile);
      ensurePrivatePasswordFile(resolvedFile);
      return password;
    }
    throw error;
  }
};

const passwordDigest = (password: string): Buffer =>
  createHash("sha256").update(password).digest();

export const matchesAdminAccessPassword = (
  expectedPassword: string,
  candidatePassword: string,
): boolean =>
  timingSafeEqual(
    passwordDigest(expectedPassword),
    passwordDigest(candidatePassword),
  );
