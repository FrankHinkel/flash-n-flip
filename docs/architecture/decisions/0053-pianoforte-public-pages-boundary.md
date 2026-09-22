# 0053: Host public Pianoforte pages outside the Flash-n-Flip app shell

Status: Accepted for implementation, 2026-09-22. Deployment is separate.

The same provider hosts Pianoforte's informational, privacy and support pages
under `flash-n-flip.com/pianoforte`. Cross-links to the Flash-n-Flip entry point
are intentional, but the pages must identify Pianoforte as a separate,
standalone piano-practice product. They do not provide the Pianoforte app or
store its scores, audio, MIDI performances or practice state.

The current Flash-n-Flip service worker has a root scope and may serve a
peer-delivered application shell for same-origin navigation. The three
`/pianoforte` public routes therefore bypass its fetch handler. This is a
narrow exception, not a migration of the existing PWA identity or scope. A
future separation of the Flash-n-Flip root landing page and `/app` PWA still
requires its own manifest, scope and offline-routing migration.

App Store URLs must only be entered after the public pages have been deployed,
tested without an account, and legally reviewed. A commit or production build
alone does not make them public.
