import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForServiceWorkerControl } from "./service-worker-control";

class ServiceWorkerContainerDouble extends EventTarget {
  controller: { scriptURL: string } | null = null;
}

describe("peer webstack service worker control", () => {
  afterEach(() => vi.useRealTimers());

  it("returns immediately when the root worker already controls the page", async () => {
    const serviceWorker = new ServiceWorkerContainerDouble();
    serviceWorker.controller = {
      scriptURL: "https://flash-n-flip.com/sw.js",
    };

    await expect(
      waitForServiceWorkerControl(
        serviceWorker as unknown as ServiceWorkerContainer,
      ),
    ).resolves.toBeUndefined();
  });

  it("waits for controllerchange before local app assets may be requested", async () => {
    const serviceWorker = new ServiceWorkerContainerDouble();
    let resolved = false;
    const waiting = waitForServiceWorkerControl(
      serviceWorker as unknown as ServiceWorkerContainer,
    ).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    serviceWorker.controller = {
      scriptURL: "https://flash-n-flip.com/sw.js",
    };
    serviceWorker.dispatchEvent(new Event("controllerchange"));

    await waiting;
    expect(resolved).toBe(true);
  });

  it("rejects instead of silently falling through to the VPS", async () => {
    vi.useFakeTimers();
    const serviceWorker = new ServiceWorkerContainerDouble();
    const waiting = waitForServiceWorkerControl(
      serviceWorker as unknown as ServiceWorkerContainer,
      "/sw.js",
      5_000,
    );
    const rejection = expect(waiting).rejects.toThrow(
      "Der lokale App-Dienst konnte die Seite noch nicht übernehmen.",
    );

    await vi.advanceTimersByTimeAsync(5_000);

    await rejection;
  });
});
