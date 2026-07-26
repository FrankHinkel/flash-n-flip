import type { Metadata, Viewport } from "next";

import { I18nProvider } from "../components/i18n-provider";
import { LanguageSwitcher } from "../components/language-switcher";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flash-n-flip.com"),
  title: {
    default: "Flash-n-Flip – Flash, Flip and Remember",
    template: "%s · Flash-n-Flip",
  },
  description:
    "Beautiful flashcards, scientifically scheduled reviews, and a curated learning community.",
  applicationName: "Flash-n-Flip",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('flash-n-flip.theme.v1')||'auto';var d=t==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'bright'):t;if(t==='dark'||t==='bright')document.documentElement.dataset.theme=t;document.documentElement.dataset.resolvedTheme=d}catch(e){}",
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <LanguageSwitcher />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
