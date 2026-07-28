# ADR 0009: Private Web access

Status: accepted

The current Flash-n-Flip deployment is an invitation-only Web and API
installation. Public self-registration is disabled. Administrators create
accounts of any valid email domain through the localhost-only administration
and assign a six-digit start PIN.

The API owns and enforces this policy. A start PIN can only establish a session
for changing the password and acknowledging the current legal documents. Every
other protected API operation returns `428` until a personal password has been
set. Resetting a start PIN revokes every existing session for that account.
Tunnel administrators remain independent and continue to require the separate
localhost-only admin access password.

Community catalog reads require authentication while the deployment is
private. The Web start page and registration route lead to the login page.
Legal documents remain readable before authentication so invited users can
review them during their required first-login password change. The API
registration endpoint remains present for future controlled rollout but
returns `403` while public registration is disabled.

The public-registration policy is configured through
`PUBLIC_REGISTRATION_ENABLED`. Changing it is a deployment decision and
requires an API restart. Mobile user interfaces are intentionally unchanged
until the separate App Store and Play Store release phase; the server-side
password-change precondition nevertheless applies to every API client.

Restricting access does not itself establish a legal household exemption and
does not remove the need for an appropriate privacy and operational review.
