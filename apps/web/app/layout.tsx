import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { I18nProvider } from "../components/i18n-provider";
import { LocalGenerationBoundary } from "../components/local-generation-boundary";
import { PagePinchZoomGuard } from "../components/page-pinch-zoom-guard";
import { ProductRuntimeBoundary } from "../components/product-runtime-boundary";
import { PwaUpdateProvider } from "../components/pwa-update-provider";
import { ThemeToggle } from "../components/theme-toggle";
import { iphonePwaMetadata, iphonePwaViewport } from "../lib/pwa-shell";

import "katex/dist/katex.min.css";
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
  appleWebApp: iphonePwaMetadata,
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  ...iphonePwaViewport,
  colorScheme: "light dark",
  themeColor: "#eef0ff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {
            "try{var t=localStorage.getItem('flash-n-flip.theme.v1');t=t==='dark'?'dark':'bright';localStorage.setItem('flash-n-flip.theme.v1',t);document.documentElement.dataset.theme=t;document.documentElement.dataset.resolvedTheme=t;if(window.Capacitor&&window.Capacitor.isPluginAvailable&&window.Capacitor.isPluginAvailable('FlashNFlipNavigation'))document.documentElement.dataset.nativeTabBar='true'}catch(e){}"
          }
        </Script>
        <I18nProvider>
          <ProductRuntimeBoundary>
            <LocalGenerationBoundary>
              <PwaUpdateProvider>
                <PagePinchZoomGuard />
                <ThemeToggle />
                {children}
              </PwaUpdateProvider>
            </LocalGenerationBoundary>
          </ProductRuntimeBoundary>
        </I18nProvider>
      </body>
    </html>
  );
}
