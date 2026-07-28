import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadAdminAccessPassword,
  matchesAdminAccessPassword,
} from "./admin-access-password.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("admin access password", () => {
  it("is disabled when no password source is configured", () => {
    expect(loadAdminAccessPassword({})).toBeNull();
  });

  it("rejects short and conflicting password configuration", () => {
    expect(() =>
      loadAdminAccessPassword({ configuredPassword: "too-short" }),
    ).toThrow("at least 32 characters");
    expect(() =>
      loadAdminAccessPassword({
        configuredPassword: "a".repeat(32),
        passwordFile: "/unused",
      }),
    ).toThrow("Configure only");
  });

  it("creates and reuses a private random password file", () => {
    const directory = mkdtempSync(join(tmpdir(), "flash-n-flip-admin-"));
    temporaryDirectories.push(directory);
    const passwordFile = join(directory, "private", "admin-password");

    const first = loadAdminAccessPassword({ passwordFile });
    const second = loadAdminAccessPassword({ passwordFile });

    expect(first).toHaveLength(43);
    expect(second).toBe(first);
    expect(readFileSync(passwordFile, "utf8").trim()).toBe(first);
    expect(statSync(passwordFile).mode & 0o777).toBe(0o600);
  });

  it("accepts a pre-provisioned read-only private secret", () => {
    const directory = mkdtempSync(join(tmpdir(), "flash-n-flip-admin-"));
    temporaryDirectories.push(directory);
    const passwordFile = join(directory, "admin-password");
    const password = "a".repeat(64);
    writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
    chmodSync(passwordFile, 0o400);

    expect(loadAdminAccessPassword({ passwordFile })).toBe(password);
    expect(statSync(passwordFile).mode & 0o777).toBe(0o400);
  });

  it("compares candidate passwords without plain-text branching", () => {
    const password = "a-secure-admin-access-password-1234";
    expect(matchesAdminAccessPassword(password, password)).toBe(true);
    expect(matchesAdminAccessPassword(password, `${password}!`)).toBe(false);
  });
});
