# ADR 0004: Web session boundary and local logout cleanup

Status: accepted

The learner routes below `/app` are protected by the Web application shell.
Before rendering private content, the shell validates the current session
through the shared API client. Missing or finally rejected credentials redirect
to `/login`; transient network failures may retain an existing local session so
offline study remains available.

The shared API client owns token refresh and clears tokens after a final `401`.
The Web token store notifies the application shell when credentials disappear,
so authorization failures from any protected request end the visible session.
The API remains the authoritative server-side authorization boundary for all
private operations.

Logout is available in desktop and mobile navigation. Before credentials are
removed, queued reviews are synchronized where possible. If synchronization
fails, deleting pending reviews requires an explicit confirmation. A completed
logout clears Web IndexedDB to prevent cached cards or reviews from crossing
account boundaries on a shared device.
