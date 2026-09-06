import { describe, expect, it } from "vitest";
import { cloudLibrarySignInConfiguration } from "./cloud-library-sign-in";

describe("explicit PWA CloudKit configuration", () => {
  it.each([undefined, "", "   "])("refuses an absent token (%s)", (token) => {
    expect(cloudLibrarySignInConfiguration(token, "development")).toBeNull();
  });
  it.each([undefined, "", "Production", "test"])("refuses an implicit or invalid environment (%s)", (environment) => {
    expect(cloudLibrarySignInConfiguration("api-token", environment)).toBeNull();
  });
  it.each(["development", "production"])("keeps the explicit %s environment", (environment) => {
    expect(cloudLibrarySignInConfiguration(" api-token ", environment)).toEqual({
      containerIdentifier: "iCloud.com.flash-n-flip",
      apiToken: "api-token",
      environment,
      signInButtonId: "fnf-cloud-library-sign-in",
      signOutButtonId: "fnf-cloud-library-sign-out",
    });
  });
});
