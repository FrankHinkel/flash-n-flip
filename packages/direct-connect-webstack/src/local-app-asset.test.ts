import { afterEach, describe, expect, it, vi } from "vitest";

import { appendLocalAppAsset } from "./local-app-asset";

const asset = () => new EventTarget() as HTMLScriptElement;
const parent = () => ({ append: vi.fn() }) as unknown as HTMLElement;

afterEach(() => vi.useRealTimers());

describe("local app asset handoff", () => {
  it("resolves when the installed asset loads", async () => {
    const script = asset();
    const target = parent();
    const loading = appendLocalAppAsset(script, target, "App fehlt", 100);

    script.dispatchEvent(new Event("load"));

    await expect(loading).resolves.toBeUndefined();
    expect(target.append).toHaveBeenCalledWith(script);
  });

  it("rejects when the installed asset fails", async () => {
    const script = asset();
    const loading = appendLocalAppAsset(script, parent(), "App fehlt", 100);

    script.dispatchEvent(new Event("error"));

    await expect(loading).rejects.toThrow("App fehlt");
  });

  it("rejects instead of waiting forever for a missing load event", async () => {
    vi.useFakeTimers();
    const loading = appendLocalAppAsset(asset(), parent(), "App fehlt", 100);
    const rejection = expect(loading).rejects.toThrow(
      "App fehlt Zeitüberschreitung.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
  });
});
