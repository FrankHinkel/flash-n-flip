import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@flashcards/api-client", "@flashcards/domain"],
};
export default config;
