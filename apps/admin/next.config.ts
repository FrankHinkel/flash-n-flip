import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@flashcards/api-client", "@flashcards/domain"],
};
export default config;
