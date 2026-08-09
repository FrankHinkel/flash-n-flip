# ADR 0020: Offline application shell and account-local Web content

- Status: Accepted
- Date: 2026-08-02
- Supersedes: The update-only cache decision in ADR 0019 sections 1 and 3
- Target peer-update model refined by: ADR 0030

## Context

The installed Web/PWA application could preserve queued reviews in IndexedDB,
but it could not start without a network connection. Its service worker was
deliberately prohibited from handling requests, and deck metadata, profiles,
deck details, and media were only available from the VPS. This contradicted the
local-first product requirement and made the existing offline review outbox
unreachable after a cold start.

## Decision

1. The Web worker precaches a versioned application shell for sign-in,
   password checks, overview, library, learning, help, and settings routes. It
   also precaches the bottom-navigation brand mark and caches immutable Next.js
   assets plus successful same-origin application navigations.
2. Application documents use network-first behavior. Immutable build assets
   use cache-first behavior. API, authentication, community, and media requests
   are never stored by this HTTP cache.
3. A new worker still waits for explicit activation. Activating a selected
   release removes only obsolete application-shell caches; IndexedDB and its
   durable review outbox remain untouched.
4. Deck lists, deck details, the last confirmed profile, and downloaded media
   are stored in the account-local IndexedDB alongside due cards and review
   mutations. Logging out or deleting the account clears these stores.
5. Previously downloaded media is served from IndexedDB. A failed cache write,
   for example because device storage is full, never hides otherwise usable
   online media.
6. While offline, internal PWA links perform document navigation so the worker
   can serve the cached application shell without requiring a Next.js server
   component request.
7. The service worker remains disabled inside the native Capacitor runtime.
   Native offline authority continues to be the bundled application plus
   SQLite defined by ADR 0018; Web caches do not become a second native update
   mechanism.
8. The installed PWA starts at `/app`. Legacy installations that still launch
   `/` receive a fresh worker-generated redirect to `/app`, so the server's
   authentication redirect is never replayed from Cache Storage. Redirected
   documents are never cached; if an intercepted application navigation does
   redirect, the worker returns a fresh synthetic redirect response. The server
   root itself returns the login document with status 200 so an already-active
   older worker can recover and install this corrected release.
9. Query-scoped learning selections are reconciled from the current browser URL
   after the cached generic learning shell hydrates. Server-provided deck and
   practice values are fallbacks only, so an offline click still opens the
   selected deck instead of the first available deck.
10. When an online learning queue is cached, its referenced private card media
    are prefetched in the background into the account-local IndexedDB store.
    Downloads are deduplicated and bounded to three concurrent requests. An
    unavailable file or exhausted device storage does not block studying or
    discard already cached cards and media.
11. Before an offline deck link triggers a cached document navigation, the
    exact same-origin study destination is preserved in tab-local session
    storage. After hydration, the learning shell prefers the real browser query
    and then this one-shot destination over stale parameters embedded in the
    generic cached Next.js document. The pending destination is consumed once.

## Consequences

- After one successful online bootstrap, the installed Web/PWA opens and the
  cached learning library remains usable without the VPS.
- Reviews remain durable through reload, process restart, and later sync.
- Only previously synchronized cards and previously downloaded media are
  available offline. New imports, editing mutations, and media downloads still
  require connectivity until their entity outboxes and resumable transfers are
  implemented.
- The current remote-URL Capacitor bridge is still not the final native offline
  release. It must be replaced by the bundled Web assets and SQLite repositories
  required by ADR 0018 before App Store release.

## Verification

- Worker tests cover versioning, shell routes, explicit activation, navigation
  fallback, the flight-mode navigation brand mark, static assets, and exclusion
  of API/media responses.
- IndexedDB tests close and reopen the database before reading cached decks,
  details, profile, media, due cards, sync cursor, and queued reviews.
- Focused Web checks cover a second-deck click through the cached learning
  shell, recovery from stale cached router parameters, offline deck selection,
  durable queue-media prefetch across a database reopen, and durable review
  queuing.
