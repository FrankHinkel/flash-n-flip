import { hostname, networkInterfaces } from "node:os";

import type { NextConfig } from "next";

const internalApiUrl =
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

const defaultApkgMaxUploadBytes = 100 * 1024 * 1024;
const multipartEnvelopeBytes = 1024 * 1024;

export const resolveApiProxyUploadSettings = (environment: {
  APKG_MAX_UPLOAD_BYTES?: string;
}): { maxBodySize: number; timeoutMs: number } => {
  const configuredMaximum = Number(environment.APKG_MAX_UPLOAD_BYTES);
  const maximumUploadBytes =
    Number.isSafeInteger(configuredMaximum) &&
    configuredMaximum > 0 &&
    configuredMaximum <= Number.MAX_SAFE_INTEGER - multipartEnvelopeBytes
      ? configuredMaximum
      : defaultApkgMaxUploadBytes;

  return {
    maxBodySize: maximumUploadBytes + multipartEnvelopeBytes,
    timeoutMs: 120_000,
  };
};

type DevelopmentNetworkInterface = {
  address: string;
  family: string | number;
  internal: boolean;
};

export const resolveAllowedDevOrigins = (
  interfaces: Record<
    string,
    readonly DevelopmentNetworkInterface[] | undefined
  >,
  machineHostname: string,
): string[] => {
  const origins = new Set(["127.0.0.1", "localhost"]);
  if (machineHostname) {
    origins.add(machineHostname);
    origins.add(`${machineHostname}.local`);
  }
  for (const details of Object.values(interfaces)) {
    for (const detail of details ?? []) {
      if (!detail.internal && detail.family === "IPv4") {
        origins.add(detail.address);
      }
    }
  }
  return [...origins];
};

const apiProxyUploadSettings = resolveApiProxyUploadSettings({
  APKG_MAX_UPLOAD_BYTES: process.env.APKG_MAX_UPLOAD_BYTES,
});

const nextConfig: NextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(networkInterfaces(), hostname()),
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: apiProxyUploadSettings.maxBodySize,
    proxyTimeout: apiProxyUploadSettings.timeoutMs,
  },
  transpilePackages: [
    "@flashcards/api-client",
    "@flashcards/domain",
    "@flashcards/i18n",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
