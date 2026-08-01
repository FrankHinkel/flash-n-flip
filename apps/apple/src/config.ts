const defaultWebUrl = "https://flash-n-flip.com";

export type NativeServerConfiguration = {
  url: string;
  cleartext?: boolean;
};

export function resolveNativeServer(
  configuredUrl: string | undefined,
): NativeServerConfiguration {
  const value = configuredUrl?.trim() || defaultWebUrl;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("CAPACITOR_SERVER_URL must use http or https");
  }
  return {
    url: url.toString().replace(/\/$/, ""),
    ...(url.protocol === "http:" ? { cleartext: true } : {}),
  };
}
