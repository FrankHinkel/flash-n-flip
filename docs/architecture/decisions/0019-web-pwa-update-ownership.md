# ADR 0019: Controlled Web/PWA updates and native store ownership

- Status: Accepted
- Date: 2026-08-02
- Partially superseded by: ADR 0020 for Web/PWA application-shell caching
- Target peer-update model refined by: ADR 0030

## Context

An installed Flash-n-Flip Web app must be able to discover a newly deployed
version without requiring the learner to remove and reinstall it. Applying an
update at an arbitrary moment could, however, interrupt a study session, an
import, or unsaved editing. The Capacitor application has a different release
boundary: native application behavior belongs to the signed App Store build
and must not be replaced through a Web service worker.

Flash-n-Flip is also migrating toward authoritative local stores. A Web update
must therefore leave IndexedDB, the durable outbox, media, and learning state
untouched.

## Decision

1. The Web application registers a root-scoped, update-only service worker.
2. Every Next.js build receives a unique build identity embedded in the worker
   source. The worker is served with `no-cache` headers so browser update checks
   can observe a deployment immediately.
3. The worker has no `fetch` handler, runtime cache, precache, API interception,
   or authentication storage. It only waits for an explicit `SKIP_WAITING`
   message and claims clients after activation.
4. The Web UI checks on registration, on an explicit settings action, and when
   returning online or to the foreground after a short interval. Installation
   always requires learner confirmation.
5. A reload action is offered only on non-editing routes. Learning, importing,
   deck creation/editing, and authentication forms are excluded. The learner
   can finish the activity and apply the update from Settings. Only the tab
   that requested activation reloads immediately; other open tabs require
   their own confirmation.
6. Native Capacitor runtimes do not register the Web worker. If a matching Web
   registration exists in that runtime, it is unregistered. Native releases
   remain owned by the signed application and its store distribution path.
7. Applying an update reloads application code only. It never clears IndexedDB,
   review queues, media, account data, or local preferences.
8. Settings show the installed application version and the actual build instant,
   formatted with date and time in the learner's local device time zone. This
   gives support and learners a visible way to confirm which deployment is
   currently running.

## Consequences

- Web and installed PWA users get a visible, controlled update path.
- A deployment cannot silently reload an active learning or editing flow.
- ADR 0020 adds a versioned Web/PWA application-shell cache while retaining the
  prohibition on caching API and authenticated responses.
- Offline application behavior continues to come from the local-first data
  adapters rather than a second, opaque HTTP cache.
- The current remote-URL Capacitor migration bridge remains temporary and is
  not made App Store ready by this decision; the final native release still
  requires bundled Web assets and store-delivered updates.

## Verification

- Unit tests cover native exclusion, safe reload routes, build identity and
  timestamp, explicit activation, and absence of fetch/cache interception.
- UI tests cover in-flow placement, narrow layouts, minimum control height, and
  bright/dark text contrast.
- Production verification checks `/sw.js` headers and confirms that normal Web,
  API, authentication, and registration-lock health checks remain unchanged.
