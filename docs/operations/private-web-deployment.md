# Public PWA and rendezvous deployment

Release 0.5.127 deploys only these production roles:

- Caddy HTTPS,
- the small `/connect` bootstrap plus the deliberately invoked `/pwa`
  fallback; `/` never selects that fallback automatically,
- a Fastify API that registers only `/health` and `/rendezvous/v1/*`,
- a STUN-only coturn process without TURN allocation or relay.

The Web image also contains the detached, signed curated catalog and the public
verification keys. It never receives the private signing key and still serves
no private learner content.

PostgreSQL, Admin, private uploads, authentication, community, server imports
and media processing are not part of the active Compose target. Existing old
VPS files remain outside this target until a separately approved cleanup.

## Production configuration

Keep `/opt/Anwendungen/flash-n-flip.com/secrets/production.env` outside version
control with mode `0600`. The required values are documented in
`deploy/production/production.env.example`; there are no account, database,
upload or admin secrets in the active target.

## Automated update

```bash
./flashnflipDeployVPS.sh --dry-run
./flashnflipDeployVPS.sh
```

The real deployment requires a clean deployment branch whose exact commit is
already present on the matching `origin` branch. The script verifies version,
remote, source commit and release gate before it transfers a Git bundle over
SSH. Production secrets are neither copied nor printed.

The server removes only disposable incoming bundles, old build cache and
dangling images. It preserves old data, secrets, volumes, backups, the running
release and rollback metadata. It then builds the shared API/Web image, starts
the reduced Compose target and verifies:

1. rendezvous-only API health,
2. STUN Binding without relay,
3. `/` and a fresh `/app` redirect to the small `/connect` bootstrap,
4. only an explicit `/pwa` request activates the public fallback,
5. HTTP 404 for retired registration and private community endpoints.

`./flashnflipDeployNoBlock.sh` remains the explicit private-test exception for
known release/legal blockers. It does not weaken source, build, health,
rendezvous or endpoint-retirement checks.

The last successful commit and version are recorded in
`deployments/last-successful`. The old data store is deliberately not deleted
by an ordinary rollout.

## Manual recovery

Use the commit and `previous_commit` from `deployments/last-successful`, switch
the server repository to that verified commit, set `FNF_APP_IMAGE` to its
recorded version and run the matching Compose file. Restoring the former
server-centred release may additionally require its preserved database,
uploads, secrets and backups; do not delete those rollback foundations during
the first reduced-stack rollout.
