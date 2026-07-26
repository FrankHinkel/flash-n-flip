const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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
  configuredUrl: string,
  metroHostUri: string | undefined,
  development: boolean,
): string {
  const normalizedUrl = urlWithoutTrailingSlash(configuredUrl);
  if (!development || !metroHostUri) return normalizedUrl;

  try {
    const apiUrl = new URL(normalizedUrl);
    if (!loopbackHosts.has(apiUrl.hostname)) return normalizedUrl;

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
