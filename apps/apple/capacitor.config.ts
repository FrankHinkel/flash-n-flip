import type { CapacitorConfig } from "@capacitor/cli";

import { resolveNativeServer } from "./src/config";

const config: CapacitorConfig = {
  appId: "com.flash-n-flip",
  appName: "Flash-n-Flip",
  webDir: "web",
  server: resolveNativeServer(process.env.CAPACITOR_SERVER_URL),
  ios: {
    backgroundColor: "#f5c505",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "FlashNFlip",
  },
};

export default config;
