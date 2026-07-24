import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Flora Moderation",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
