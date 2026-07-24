import type { Metadata, Viewport } from "next";

import { I18nProvider } from "../components/i18n-provider";
import { LanguageSwitcher } from "../components/language-switcher";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flash-n-flip.com"),
  title: {
    default: "Flash & Flip – Flash, Flip and Remember",
    template: "%s · Flash & Flip",
  },
  description:
    "Beautiful flashcards, scientifically scheduled reviews, and a curated learning community.",
  applicationName: "Flash & Flip",
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#eef0ff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <LanguageSwitcher />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
