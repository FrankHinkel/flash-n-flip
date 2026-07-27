import { hostname, networkInterfaces } from "node:os";

import type { NextConfig } from "next";

const internalApiUrl =
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

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
  output: "standalone",
  reactStrictMode: true,
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
