import type { NextConfig } from "next";

const internalApiUrl =
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
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
