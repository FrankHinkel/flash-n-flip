# ADR 0024: Trusted-device password recovery without email

## Status

Accepted.

## Context

Flash-n-Flip accounts can be used on several local-first clients. A password
change must therefore invalidate credentials held by other clients without
deleting their learner-owned local data. The restricted test service does not
operate a transactional email service, but users still need a secure recovery
path when one device is signed out.

## Decision

- The VPS remains the sole authority for account credentials and sessions.
- A fully authenticated device may create one password-recovery code. The code
  contains 60 random bits, avoids ambiguous characters, expires after ten
  minutes, and replaces any older unused recovery code for the account.
- Only the SHA-256 digest is persisted in `auth_tokens`; plaintext is returned
  once to the authenticated client and is not logged.
- A signed-out client resets the password with the account email, the code, and
  a new password. The endpoint is rate-limited and returns the same error for an
  unknown, expired, or already consumed code.
- A successful reset atomically consumes the code, replaces the password hash,
  revokes every existing session, and creates one session for the recovering
  client. Registered devices, local databases, outboxes, decks, media, and
  learning progress are not deleted.
- A normal password change requires the current password and revokes every
  other session while retaining the current one. It also invalidates unused
  recovery codes.
- If no authenticated device remains, recovery without another independent
  factor is intentionally impossible. The existing administrator-issued start
  PIN remains the manual support path for the restricted test operation.

## Consequences

No email address is sent to another provider and no new persistence table is
needed. Recovery depends on possession of a still-authenticated device, so
users must keep at least one session active or use the administrator path. The
API contract is platform-neutral and can be reused by Web, iOS, Android, macOS,
and Windows clients.
