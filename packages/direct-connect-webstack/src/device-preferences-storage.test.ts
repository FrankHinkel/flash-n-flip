import "fake-indexeddb/auto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IndexedDbDevicePreferences,
  NativeDevicePreferences,
} from "./device-preferences-storage";

describe("device-only preferences", () => {
  it("survives reopening IndexedDB and stays separate between devices", async () => {
    const name = `device-${crypto.randomUUID()}`;
    const first = new IndexedDbDevicePreferences(name);
    expect(await first.get("text-size")).toBeNull();
    await first.set("text-size", "large");
    expect(await new IndexedDbDevicePreferences(name).get("text-size")).toBe(
      "large",
    );
    expect(
      await new IndexedDbDevicePreferences(`other-${name}`).get("text-size"),
    ).toBeNull();
    await first.set("text-size", "normal");
    expect(await first.get("text-size")).toBe("normal");
  });

  it("persists in real SQLite across connection restart without library tables", async () => {
    const directory = mkdtempSync(join(tmpdir(), "fnf-device-settings-"));
    const path = join(directory, "device.sqlite");
    let database = new DatabaseSync(path);
    const connect = () => ({
      async createConnection() {},
      async isDBOpen() {
        return { result: true };
      },
      async open() {},
      async execute({ statements }: { statements?: string }) {
        database.exec(statements!);
        return { changes: { changes: 0 } };
      },
      async run({
        statement,
        values,
      }: {
        statement: string;
        values?: unknown[];
      }) {
        database.exec("BEGIN");
        try {
          database.prepare(statement).run(...(values as SQLInputValue[]));
          database.exec("COMMIT");
        } catch (cause) {
          database.exec("ROLLBACK");
          throw cause;
        }
        return { changes: { changes: 1 } };
      },
      async query({
        statement,
        values,
      }: {
        statement: string;
        values?: unknown[];
      }) {
        return {
          values: database
            .prepare(statement)
            .all(...(values as SQLInputValue[])),
        };
      },
    });
    try {
      const first = new NativeDevicePreferences(connect(), crypto.randomUUID());
      await first.set("text-size", "small");
      database.close();
      database = new DatabaseSync(path);
      expect(
        await new NativeDevicePreferences(connect(), crypto.randomUUID()).get(
          "text-size",
        ),
      ).toBe("small");
      expect(
        database
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all(),
      ).toEqual([{ name: "device_preferences" }]);
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
