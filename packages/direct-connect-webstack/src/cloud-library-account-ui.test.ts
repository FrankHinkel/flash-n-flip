import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCloudLibraryWeb } from "./cloud-library-web";

afterEach(() => vi.unstubAllGlobals());
describe("non-rendering CloudKit account checks", () => {
  it("initializes controls once and checks identity without rebuilding them", async () => {
    const container = {
      setUpAuth: vi.fn(async () => ({userRecordName:"account-a"})),
      fetchCurrentUserIdentity: vi.fn(async (): Promise<{userRecordName:string} | null> => ({userRecordName:"account-a"})),
      whenUserSignsIn: vi.fn(() => new Promise(() => {})),
      whenUserSignsOut: vi.fn(() => new Promise(() => {})),
      privateCloudDatabase: {fetchRecords: vi.fn(), saveRecords: vi.fn()},
    };
    vi.stubGlobal("window", {CloudKit: {
      configure: vi.fn(), getDefaultContainer: () => container,
      DEVELOPMENT_ENVIRONMENT:"development", PRODUCTION_ENVIRONMENT:"production",
    }});
    vi.stubGlobal("document", {getElementById: () => ({})});
    const session = await prepareCloudLibraryWeb({
      containerIdentifier:"iCloud.com.flash-n-flip",apiToken:"fixture-token",
      environment:"development",signInButtonId:"in",signOutButtonId:"out",
    });
    await expect(session.account()).resolves.toBe("account-a");
    await expect(session.account()).resolves.toBe("account-a");
    const changed = vi.fn(), error = vi.fn();
    const dispose = session.observeAccount(changed,error);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("account-a"));
    dispose();
    container.fetchCurrentUserIdentity.mockRejectedValueOnce({serverErrorCode:"AUTHENTICATION_REQUIRED"});
    await expect(session.account()).resolves.toBeNull();
    container.fetchCurrentUserIdentity.mockRejectedValueOnce(new Error("offline"));
    await expect(session.account()).rejects.toThrow("offline");
    expect(container.setUpAuth).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});
