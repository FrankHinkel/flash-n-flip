# ADR 0007: Local-only moderation access through an SSH tunnel

Status: accepted

The moderation application is a separate Next.js process bound to
`127.0.0.1:3001`. It must not be published through the public reverse proxy. A
remote operator reaches it through an SSH local-port forward created by
`flashnflipAdminTunnel.sh`.

The API creates or reads a random 256-bit access password from
`FNF_ADMIN_ACCESS_PASSWORD_FILE`. The tunnel script retrieves that password
over the already authenticated SSH connection. The moderation browser exchanges
it for an eight-hour API session and stores the resulting tokens in
`sessionStorage`, so closing the tab removes the browser-side session.

Moderation transitions remain server-authorized and continue to create the
existing immutable moderation and audit records. Tunnel access uses one
dedicated internal administrator actor. Before access is delegated to multiple
independent moderators, this shared operator identity must be replaced by
person-specific administrator accounts or an identity provider so that audit
records remain individually attributable.

The password file is secret deployment state. It must have mode `0600`, reside
outside version control, be backed up or deliberately rotated, and be mounted
into the API container when containers are used. A container port may only be
published as `127.0.0.1:<host-port>:3001`.
