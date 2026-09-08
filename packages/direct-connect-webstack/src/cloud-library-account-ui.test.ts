import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCloudLibraryWeb } from "./cloud-library-web";

afterEach(() => vi.unstubAllGlobals());
describe("non-rendering CloudKit account checks", () => {
  it("keeps the persisted setUpAuth identity without a second caller lookup", async () => {
    const configure = vi.fn();
    const tokens = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => tokens.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { tokens.set(key, value); }),
      removeItem: vi.fn((key: string) => { tokens.delete(key); }),
    };
    const container = {
      setUpAuth: vi.fn(async () => ({userRecordName:"account-a"})),
      whenUserSignsIn: vi.fn(() => new Promise(() => {})),
      whenUserSignsOut: vi.fn(() => new Promise(() => {})),
      privateCloudDatabase: {fetchRecords: vi.fn(), saveRecords: vi.fn()},
    };
    vi.stubGlobal("window", {localStorage, CloudKit: {
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
    })], services: {authTokenStore: expect.any(Object)}}));
    const tokenStore = configure.mock.calls[0]![0].services.authTokenStore;
    tokenStore.putToken("iCloud.com.flash-n-flip", "persisted-token");
    expect(tokenStore.getToken("iCloud.com.flash-n-flip")).toBe("persisted-token");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "flash-n-flip.cloudkit-auth.development.iCloud.com.flash-n-flip",
      "persisted-token",
    );
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

  it("bootstraps without mounted buttons and renders them when the route appears", async () => {
    const container = {
      setUpAuth: vi.fn()
        .mockResolvedValueOnce({userRecordName: "account-a"})
        .mockResolvedValueOnce({userRecordName: "account-a"}),
      whenUserSignsIn: vi.fn(() => new Promise(() => {})),
      whenUserSignsOut: vi.fn(() => new Promise(() => {})),
      privateCloudDatabase: {fetchRecords: vi.fn(), saveRecords: vi.fn()},
    };
    vi.stubGlobal("window", {CloudKit: {
      configure: vi.fn(), getDefaultContainer: () => container,
      DEVELOPMENT_ENVIRONMENT:"development", PRODUCTION_ENVIRONMENT:"production",
    }});
    vi.stubGlobal("document", {getElementById: () => null});
    const session = await prepareCloudLibraryWeb({
      containerIdentifier:"iCloud.com.flash-n-flip",apiToken:"fixture-token",
      environment:"development",signInButtonId:"in",signOutButtonId:"out",
    });

    await expect(session.refreshAccount()).resolves.toBe("account-a");
    expect(container.setUpAuth).toHaveBeenCalledTimes(2);
  });
});
