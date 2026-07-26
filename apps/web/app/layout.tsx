import type { Metadata, Viewport } from "next";

import { I18nProvider } from "../components/i18n-provider";
import { ThemeToggle } from "../components/theme-toggle";
import { homeSessionRedirectScript } from "../lib/auth-storage";

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
          dangerouslySetInnerHTML={{ __html: homeSessionRedirectScript }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('flash-n-flip.theme.v1');t=t==='dark'?'dark':'bright';localStorage.setItem('flash-n-flip.theme.v1',t);document.documentElement.dataset.theme=t;document.documentElement.dataset.resolvedTheme=t}catch(e){}",
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <ThemeToggle />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
