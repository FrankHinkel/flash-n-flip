import { describe, expect, it } from "vitest";

import { createSerialInstallQueue } from "./deck-catalog-install-queue";

describe("discover catalog install queue", () => {
  it("runs distinct collection installs one after another", async () => {
    const queue = createSerialInstallQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
    });
    const second = queue.enqueue(async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("continues with the next install after a failure", async () => {
    const queue = createSerialInstallQueue();
    const failed = queue.enqueue(async () => {
      throw new Error("failed");
    });
    const recovered = queue.enqueue(async () => "installed");

    await expect(failed).rejects.toThrow("failed");
    await expect(recovered).resolves.toBe("installed");
  });
});
