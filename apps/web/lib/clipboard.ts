"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

interface FlashNFlipClipboardPlugin {
  writeText(options: { text: string }): Promise<void>;
}

const nativeClipboard = registerPlugin<FlashNFlipClipboardPlugin>(
  "FlashNFlipClipboard",
);

// The installed app uses a custom URL scheme; clipboard permissions there do
// not follow the same rules as an HTTPS browser page.
export async function copyText(text: string): Promise<void> {
  if (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("FlashNFlipClipboard")
  ) {
    await nativeClipboard.writeText({ text });
    return;
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable");
  }
  await navigator.clipboard.writeText(text);
}
