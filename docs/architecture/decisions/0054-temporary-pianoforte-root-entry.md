# 0054: Route the public root to Pianoforte until the app gallery exists

Status: Accepted for implementation, 2026-09-22. Supersedes the cross-link
decision in ADR 0053; its Pianoforte service-worker boundary still applies.

Flash-n-Flip is not yet ready to be promoted from its restricted test operation.
The public root of `flash-n-flip.com` temporarily redirects to `/pianoforte`.
The Pianoforte overview, privacy and support pages link only within their own
section and do not advertise Flash-n-Flip. The direct `/app` and `/pwa` paths
remain available for deliberate Flash-n-Flip testing. Local development keeps
its existing root-to-`/app` shortcut.

The root-scoped service worker must agree with the server redirect and continue
to bypass `/pianoforte` routes. An already active older worker may keep its old
root behavior until the user activates the worker update; changing `/pwa` would
break the explicit Flash-n-Flip entry and is not a safe workaround.

Later, replace the temporary root redirect with a redirect to `/apps`. That
route should present a gallery of released applications, initially
Flash-n-Flip and Pianoforte, with an App Store QR code for each actual store
listing. Do not publish placeholder QR codes or claim a store listing exists
before its final URL is available. Keep `/app` separately reachable.
