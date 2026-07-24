import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@flashcards/api-client",
    "@flashcards/domain",
    "@flashcards/i18n",
  ],
};

export default nextConfig;
