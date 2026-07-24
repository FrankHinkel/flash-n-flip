import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@flashcards/api-client", "@flashcards/domain"],
};

export default nextConfig;
