import { describe, expect, it, vi } from "vitest";

import { goBackOrReplace } from "./navigation";

describe("goBackOrReplace", () => {
  it("returns through the navigator when history is available", () => {
    const back = vi.fn();
    const replace = vi.fn();

    goBackOrReplace({ canGoBack: () => true, back, replace }, "/(tabs)");

    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens the explicit fallback when the screen has no history", () => {
    const back = vi.fn();
    const replace = vi.fn();

    goBackOrReplace({ canGoBack: () => false, back, replace }, "/(tabs)");

    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/(tabs)");
  });
});
