import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCloudLibraryWeb } from "./cloud-library-web";

afterEach(() => vi.unstubAllGlobals());
describe("non-rendering CloudKit account checks", () => {
  it("keeps the persisted setUpAuth identity without a second caller lookup", async () => {
    const configure = vi.fn();
    const container = {
      setUpAuth: vi.fn(async () => ({userRecordName:"account-a"})),
      whenUserSignsIn: vi.fn(() => new Promise(() => {})),
      whenUserSignsOut: vi.fn(() => new Promise(() => {})),
      privateCloudDatabase: {fetchRecords: vi.fn(), saveRecords: vi.fn()},
    };
    vi.stubGlobal("window", {CloudKit: {
      configure, getDefaultContainer: () => container,
      DEVELOPMENT_ENVIRONMENT:"development", PRODUCTION_ENVIRONMENT:"production",
    }});
    vi.stubGlobal("document", {getElementById: () => ({})});
    const session = await prepareCloudLibraryWeb({
      containerIdentifier:"iCloud.com.flash-n-flip",apiToken:"fixture-token",
      environment:"development",signInButtonId:"in",signOutButtonId:"out",
    });
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({containers: [expect.objectContaining({
      apiTokenAuth: expect.objectContaining({persist: true}),
    })]}));
    await expect(session.account()).resolves.toBe("account-a");
    await expect(session.account()).resolves.toBe("account-a");
    const changed = vi.fn(), error = vi.fn();
    const dispose = session.observeAccount(changed,error);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("account-a"));
    dispose();
    await expect(session.account()).resolves.toBe("account-a");
    expect(container.setUpAuth).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});
