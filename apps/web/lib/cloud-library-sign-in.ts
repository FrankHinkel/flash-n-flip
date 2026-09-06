import type { CloudLibraryWebConfiguration } from "@flashcards/direct-connect-webstack/cloud-library-web";

export const cloudSignInButtonId = "fnf-cloud-library-sign-in";
export const cloudSignOutButtonId = "fnf-cloud-library-sign-out";

// App-owned configuration is passed explicitly to the platform adapter.
// No fallback environment: development and production contain different data.
export function cloudLibrarySignInConfiguration(
  apiToken: string | undefined,
  environment: string | undefined,
): CloudLibraryWebConfiguration | null {
  if (!apiToken?.trim() ||
      (environment !== "development" && environment !== "production")) {
    return null;
  }
  return {
    containerIdentifier: "iCloud.com.flash-n-flip",
    apiToken: apiToken.trim(),
    environment,
    signInButtonId: cloudSignInButtonId,
    signOutButtonId: cloudSignOutButtonId,
  };
}
