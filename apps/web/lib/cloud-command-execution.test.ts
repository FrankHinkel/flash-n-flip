import { describe, expect, it, vi } from "vitest";

import { executeCloudCommandAction } from "./cloud-command-execution";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

describe("iCloud command execution", () => {
  it("deletes cloud-only decks without starting a full synchronization", async () => {
    const synchronize = vi.fn(async () => {
      throw new Error("full synchronization must not start");
    });
    const executeCommand = vi.fn(async () => undefined);
    const persist = vi.fn(async () => undefined);
    const complete = vi.fn(async () => undefined);

    await executeCloudCommandAction(
      {
        synchronize,
        state: vi.fn(async () => null),
        executeCommand,
      } as never,
      {
        kind: "command",
        deckId: id("000000000003"),
        command: "deck",
      },
      {
        check: () => undefined,
        createId: () => id("000000000030"),
        persist,
        complete,
      },
    );

    expect(synchronize).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
