import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CloudTransferControl,
  CloudTransferStopped,
  cloudTransferProblem,
} from "./cloud-transfer-control";

afterEach(() => {
  vi.useRealTimers();
});

describe("CloudTransferControl", () => {
  it("stops a cloud request that does not answer within its deadline", async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    const control = new CloudTransferControl(30_000, completed);
    const request = control.request(() => new Promise<string>(() => undefined));
    const rejected = expect(request).rejects.toEqual(new CloudTransferStopped("timeout"));

    await vi.advanceTimersByTimeAsync(30_000);

    await rejected;
    expect(control.reason).toBe("timeout");
    expect(completed).not.toHaveBeenCalled();
  });

  it("pauses immediately and fences a late successful reply", async () => {
    let finish!: (value: string) => void;
    const completed = vi.fn();
    const control = new CloudTransferControl(30_000, completed);
    const request = control.request(() => new Promise<string>(resolve => { finish = resolve; }));
    const rejected = expect(request).rejects.toEqual(new CloudTransferStopped("paused"));

    await Promise.resolve();
    control.stop("paused");
    await rejected;
    finish("late result");
    await Promise.resolve();

    expect(control.reason).toBe("paused");
    expect(completed).not.toHaveBeenCalled();
    await expect(control.request(async () => "unexpected")).rejects.toEqual(new CloudTransferStopped("paused"));
  });

  it("counts only completed requests and classifies user-facing failures", async () => {
    const completed = vi.fn();
    const control = new CloudTransferControl(30_000, completed);

    await expect(control.request(async () => "ok")).resolves.toBe("ok");
    expect(completed).toHaveBeenCalledWith(1);
    expect(cloudTransferProblem(Object.assign(new Error("auth"), { code: "AUTHENTICATION_REQUIRED" }))).toBe("account");
    expect(cloudTransferProblem(Object.assign(new Error("quota"), { code: "QUOTA_EXCEEDED" }))).toBe("quota");
    expect(cloudTransferProblem(new CloudTransferStopped("timeout"))).toBe("timeout");
  });
});
