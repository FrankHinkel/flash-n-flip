import { randomUUID } from "node:crypto";
import { hostname, networkInterfaces } from "node:os";

import type { NextConfig } from "next";

import webPackage from "./package.json";

const internalApiUrl =
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

export const resolveWebBuildId = (
  configuredBuildId: string | undefined,
  createFallback: () => string = randomUUID,
): string => configuredBuildId?.trim() || createFallback();

const webBuildId = resolveWebBuildId(process.env.FNF_WEB_BUILD_ID);

export const resolveWebBuildTime = (
  configuredBuildTime: string | undefined,
  createFallback: () => string = () => new Date().toISOString(),
): string => {
  const value = configuredBuildTime?.trim();
  if (!value) return createFallback();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`FNF_WEB_BUILD_TIME must be a valid date: ${value}`);
  }
  return parsed.toISOString();
};

const webBuildTime = resolveWebBuildTime(process.env.FNF_WEB_BUILD_TIME);

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

const nextConfig: NextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(networkInterfaces(), hostname()),
  env: {
    NEXT_PUBLIC_FNF_APP_VERSION: webPackage.version,
    NEXT_PUBLIC_FNF_WEB_BUILD_ID: webBuildId,
    NEXT_PUBLIC_FNF_WEB_BUILD_TIME: webBuildTime,
    NEXT_PUBLIC_FNF_PORTABLE_AUDIO_WORKER: "0",
  },
  generateBuildId: async () => webBuildId,
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@flashcards/api-client",
    "@flashcards/domain",
    "@flashcards/i18n",
    "@flashcards/peer-transfer",
    "@flashcards/sync",
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
