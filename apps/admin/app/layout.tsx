import type { Metadata } from "next";

import { I18nProvider } from "../components/i18n-provider";
import { LanguageSwitcher } from "../components/language-switcher";

import "./styles.css";

export const metadata: Metadata = {
  title: "Flash-n-Flip Moderation",
  description: "Internal Flash-n-Flip moderation workspace.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
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
