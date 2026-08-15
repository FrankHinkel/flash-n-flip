# ADR 0037: Installed application runtime boundary

- Status: Accepted
- Date: 15 August 2026

## Context

Flash-n-Flip stores learner-owned decks, media, settings, and progress in the
local application store. Opening the product in a regular browser tab can
create a second local storage context, especially on Apple platforms where an
installed Home Screen or Dock web app keeps storage separate from Safari.
The public root previously opened the direct-connect shell, which also made
device pairing appear to be the primary product entry.

## Decision

1. The public root redirects to `/pwa`. Direct connection remains explicitly
   available under `/connect` but no longer owns the root route.
2. `/pwa` remains the installation bootstrap and establishes the existing
   server-side PWA fallback cookie before redirecting to `/app`. The manifest
   continues to start at `/app` so an installed PWA keeps its offline launch
   path.
3. Product routes are rendered only in a native Capacitor runtime or when the
   browser reports an applied `standalone` or `minimal-ui` display mode. The
   legacy iOS `navigator.standalone` signal is retained as a compatibility
   fallback.
4. Browser fullscreen is not accepted because it is not proof of an installed
   application context.
5. A regular browser receives a blocking, keyboard-focusable installation
   explanation. There is no browser bypass. The direct-connect shell and legal
   documents remain outside this product-runtime boundary.
6. The route boundary runs before localization, local-generation, theme, and
   PWA-update providers. Direct synchronization, import recovery, and all local
   product storage therefore start only after the installed-app check succeeds.
   The same ordering applies to the portable peer-transferred Web application.
7. Display-mode and Capacitor detection remain Web platform adapter logic and
   do not enter the shared domain, scheduler, or synchronization contracts.

## Consequences

- Learners get one deliberate app-local product context instead of casually
  creating a browser-local second library.
- iPhone, iPad, Mac, Windows, and Android users receive platform-appropriate
  installation instructions when they open the product in a browser.
- Capacitor builds remain usable even though WKWebView does not expose PWA
  display modes.
- A user must install and launch the PWA before using the product UI. Pairing
  that should write into the installed app must also be initiated from that
  installed context.
