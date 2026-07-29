import type { Metadata, Viewport } from "next";

export const iphonePwaViewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
} satisfies Viewport;

export const iphonePwaMetadata = {
  capable: true,
  title: "Flash-n-Flip",
  statusBarStyle: "default",
} satisfies NonNullable<Metadata["appleWebApp"]>;
