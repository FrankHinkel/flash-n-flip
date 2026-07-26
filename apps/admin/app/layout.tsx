import type { Metadata } from "next";

import { I18nProvider } from "../components/i18n-provider";
import { LanguageSwitcher } from "../components/language-switcher";

import "./styles.css";

export const metadata: Metadata = {
  title: "Flash & Flip Moderation",
  description: "Internal Flash & Flip moderation workspace.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
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
