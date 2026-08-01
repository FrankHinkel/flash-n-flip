import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flash-n-Flip",
    short_name: "Flash-n-Flip",
    description: "Flash, Flip and Remember.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F6F2",
    theme_color: "#F7F6F2",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
