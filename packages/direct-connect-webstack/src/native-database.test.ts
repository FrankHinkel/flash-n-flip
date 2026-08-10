import { describe, expect, it, vi } from "vitest";

import { ensureNativeDatabaseConnection } from "./native-database";

describe("native database connection lifecycle", () => {
  it("reuses the native connection after the WebView document changes", async () => {
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValue(
          new Error("Connection flash-n-flip-local-v2 already exists"),
        ),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
    };

    await ensureNativeDatabaseConnection(sqlite, "existing-connection");

    expect(sqlite.createConnection).toHaveBeenCalledOnce();
    expect(sqlite.isDBOpen).toHaveBeenCalledOnce();
    expect(sqlite.open).not.toHaveBeenCalled();
  });

  it("opens an existing native connection when its database is closed", async () => {
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValue(
          new Error("Connection flash-n-flip-local-v2 already exists"),
        ),
      isDBOpen: vi.fn().mockResolvedValue({ result: false }),
      open: vi.fn().mockResolvedValue(undefined),
    };

    await ensureNativeDatabaseConnection(sqlite, "closed-connection");

    expect(sqlite.isDBOpen).toHaveBeenCalledOnce();
    expect(sqlite.open).toHaveBeenCalledOnce();
  });

  it("creates a missing connection and permits a retry after failure", async () => {
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValueOnce(new Error("bridge reloading"))
        .mockResolvedValueOnce(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: false }),
      open: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      ensureNativeDatabaseConnection(sqlite, "retry-connection"),
    ).rejects.toThrow("bridge reloading");
    await expect(
      ensureNativeDatabaseConnection(sqlite, "retry-connection"),
    ).resolves.toBeUndefined();

    expect(sqlite.createConnection).toHaveBeenCalledTimes(2);
    expect(sqlite.open).toHaveBeenCalledOnce();
  });
});
