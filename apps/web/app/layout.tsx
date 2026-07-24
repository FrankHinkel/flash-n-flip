import type { Metadata, Viewport } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "Flora – Lernen, das bleibt",
    template: "%s · Flora",
  },
  description:
    "Schöne Lernkarten, wissenschaftlich geplante Wiederholungen und eine kuratierte Community.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#eef0ff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
