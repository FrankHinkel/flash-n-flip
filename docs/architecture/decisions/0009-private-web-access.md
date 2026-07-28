# ADR 0009: Private Web access

Status: accepted

The current Flash-n-Flip deployment is a private Web and API installation.
Public self-registration is disabled, and non-administrative accounts must use
an email address whose domain exactly matches a configured allowlist. The
initial production allowlist contains only `hi-sys.de`; subdomains and
lookalike suffixes do not match.

The API owns and enforces this policy. It checks login, refresh, and every
authenticated request so an existing session for a non-allowed account cannot
continue to access private data. Tunnel administrators remain independent of
the learner-domain policy and continue to require the separate localhost-only
admin access password.

Community catalog reads require authentication while the deployment is
private. The Web start page and registration route lead to the login page.
Community and legal routes verify the current API session before rendering
their content. The API registration endpoint remains present for future
controlled rollout but returns `403` while public registration is disabled.

The policy is configured explicitly through
`AUTH_ALLOWED_EMAIL_DOMAINS` and `PUBLIC_REGISTRATION_ENABLED`. Changing either
value is a deployment decision and requires an API restart. Mobile user
interfaces are intentionally unchanged until the separate App Store and Play
Store release phase; the server-side policy nevertheless applies to every API
client.

Restricting access does not itself establish a legal household exemption and
does not remove the need for an appropriate privacy and operational review.
