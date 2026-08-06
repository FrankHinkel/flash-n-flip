import { describe, expect, it, vi } from "vitest";

import { apiIsReachable } from "./api-connectivity";

describe("API connectivity", () => {
  it("checks the same-origin API proxy instead of a remote host", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));

    await expect(apiIsReachable(fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });

  it("reports an unavailable API even if the browser has a network", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(apiIsReachable(fetcher)).resolves.toBe(false);
  });

  it("reports a failed local request without leaking the network error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("network failed"));

    await expect(apiIsReachable(fetcher)).resolves.toBe(false);
  });
});
