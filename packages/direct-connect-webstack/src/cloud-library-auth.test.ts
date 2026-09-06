import { describe, expect, it, vi } from "vitest";
import { observeCloudLibraryAccount } from "./cloud-library-web";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("CloudKit authentication observation", () => {
  it("follows sign-in, sign-out and account switch without polling or record access", async () => {
    const first = deferred<{ userRecordName: string }>();
    const second = deferred<{ userRecordName: string }>();
    const out = deferred<void>();
    const container = {
      setUpAuth: vi.fn(async () => null),
      whenUserSignsIn: vi.fn().mockReturnValueOnce(first.promise).mockReturnValue(second.promise),
      whenUserSignsOut: vi.fn(() => out.promise),
    };
    const changed = vi.fn();
    const error = vi.fn();
    const dispose = observeCloudLibraryAccount(container, changed, error);
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(null));
    first.resolve({ userRecordName: "account-a" });
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith("account-a"));
    out.resolve();
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(null));
    // Dispose as soon as the second account arrives: the fixture's sign-out
    // promise represents only the first session.
    changed.mockImplementation((account: string | null) => {
      if (account === "account-b") dispose();
    });
    second.resolve({ userRecordName: "account-b" });
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith("account-b"));
    expect(container.setUpAuth).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("does not emit after unmount or delete a persisted session", async () => {
    const pending = deferred<{ userRecordName: string }>();
    const container = {
      setUpAuth: vi.fn(() => pending.promise),
      whenUserSignsIn: vi.fn(),
      whenUserSignsOut: vi.fn(),
    };
    const changed = vi.fn();
    const error = vi.fn();
    observeCloudLibraryAccount(container, changed, error)();
    pending.resolve({ userRecordName: "account-a" });
    await pending.promise;
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    expect(container.whenUserSignsOut).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("reports authentication failure rather than an empty or signed-out library", async () => {
    const failure = new Error("network unavailable");
    const changed = vi.fn();
    const error = vi.fn();
    const dispose = observeCloudLibraryAccount({
      setUpAuth: vi.fn().mockRejectedValue(failure),
      whenUserSignsIn: vi.fn(), whenUserSignsOut: vi.fn(),
    }, changed, error);
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(failure));
    expect(changed).not.toHaveBeenCalled();
    dispose();
  });

  it("handles a rejected Apple event without an unhandled rejection", async () => {
    const pending = deferred<void>();
    const error = vi.fn();
    const changed = vi.fn();
    const dispose = observeCloudLibraryAccount({
      setUpAuth: async () => ({ userRecordName: "existing-account" }),
      whenUserSignsIn: vi.fn(), whenUserSignsOut: () => pending.promise,
    }, changed, error);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("existing-account"));
    pending.reject(new Error("session unavailable"));
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    dispose();
  });
});
