const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const localDevelopmentApiUrl = "http://127.0.0.1:4000";

export type MobileRuntime = {
  isDevice: boolean;
  platform: "android" | "ios" | "web";
};

const urlWithoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const hostnameFromHostUri = (hostUri: string): string | null => {
  try {
    const parsed = new URL(
      hostUri.includes("://") ? hostUri : `http://${hostUri}`,
    );
    return parsed.hostname;
  } catch {
    return null;
  }
};

export function resolveMobileApiUrl(
  explicitUrl: string | undefined,
  bundledUrl: string,
  metroHostUri: string | undefined,
  development: boolean,
  runtime: MobileRuntime,
): string {
  const configuredUrl =
    explicitUrl?.trim() ||
    (development && !runtime.isDevice && runtime.platform !== "web"
      ? localDevelopmentApiUrl
      : bundledUrl);
  const normalizedUrl = urlWithoutTrailingSlash(configuredUrl);
  if (!development) return normalizedUrl;

  try {
    const apiUrl = new URL(normalizedUrl);
    if (!loopbackHosts.has(apiUrl.hostname)) return normalizedUrl;

    if (!runtime.isDevice) {
      if (runtime.platform === "android") {
        apiUrl.hostname = "10.0.2.2";
        return urlWithoutTrailingSlash(apiUrl.toString());
      }

      return normalizedUrl;
    }

    if (!metroHostUri) return normalizedUrl;

    const metroHostname = hostnameFromHostUri(metroHostUri);
    if (!metroHostname || loopbackHosts.has(metroHostname)) {
      return normalizedUrl;
    }

    apiUrl.hostname = metroHostname;
    return urlWithoutTrailingSlash(apiUrl.toString());
  } catch {
    return normalizedUrl;
  }
}
