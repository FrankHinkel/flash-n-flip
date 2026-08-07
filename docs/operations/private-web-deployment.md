# Private Web deployment

This procedure deploys the Web, API, and localhost-only admin applications
with Docker Compose and Caddy. It does not build, sign, or publish the iOS and
Android applications.

## Required production configuration

Keep the production environment file at
`/opt/Anwendungen/flash-n-flip.com/secrets/production.env` outside version
control with mode `0600`. Start with
`deploy/production/production.env.example`, generate independent random
secrets, create the admin password at
`/opt/Anwendungen/flash-n-flip.com/secrets/admin-access-password` with mode
`0400` for the unprivileged container user, and verify these values:

```dotenv
NODE_ENV=production
PUBLIC_REGISTRATION_ENABLED=false
API_HOST=0.0.0.0
API_PORT=4000
API_PUBLIC_URL=https://flash-n-flip.com/api
API_INTERNAL_URL=http://api:4000
ALLOWED_ORIGINS=https://flash-n-flip.com
NEXT_PUBLIC_API_URL=/api
FNF_ADMIN_ACCESS_PASSWORD_FILE=/run/secrets/admin-access-password
```

Set independent high-entropy values for `JWT_SECRET` and
`FNF_DECK_MASTER_SECRET`. Preserve both secrets in the deployment secret
backup. Losing the deck master secret makes protected deck packages
unrecoverable.

Public registration stays disabled. Do not enable it temporarily on an
Internet-facing API to provision an account. Open the localhost-only
administration through `./flashnflipAdminTunnel.sh`, then create accounts of any
email domain under **Users** with a six-digit start PIN. The invited user must
replace that PIN with a personal password during the first sign-in. An
administrator can issue a new start PIN from the same page; doing so revokes
all existing sessions for that account.

## Automated update

The repository-root deployment script performs the source checks, backup,
build, migration, rollout, health checks, and deployment logging in the order
documented below:

```bash
./flashnflipDeployVPS.sh --dry-run
./flashnflipDeployVPS.sh
```

The real deployment requires a clean `main` working tree whose exact commit is
already available on `origin/main`. It asks for the literal
confirmation `DEPLOY`. Use `--yes` only from an already protected automation
environment.

The script verifies that exact commit against GitHub on the development
machine, packages the verified branch as a Git bundle, and transfers it over
the existing SSH connection. The VPS therefore needs no separate GitHub deploy
key. Before switching revisions, the server verifies both the bundle and its
branch commit again.

Host, SSH user, SSH port, remote directory, branch, and public domain can be
set through `FNF_SSH_HOST`, `FNF_SSH_USER`, `FNF_SSH_PORT`, `FNF_REMOTE_DIR`,
`FNF_DEPLOY_BRANCH`, and `FNF_PRODUCTION_DOMAIN`, either in the process
environment or in the repository-root `.env`. The script never copies or
prints production secrets.

By default, the script runs the complete release-readiness gate. If a private
test deployment must proceed despite a separately documented release blocker,
the operator can make that exceptional decision explicit with
`--skip-release-check`. This flag does not bypass source, backup, migration,
health, authentication, or registration checks.

The maintained shorthand for that explicit exceptional path is:

```bash
./flashnflipDeployNoBlock.sh
```

It supplies `--skip-release-check --yes` to the regular deployment script.
Additional supported arguments such as `--dry-run` are forwarded unchanged.
The wrapper therefore removes the release gate and interactive confirmation,
but retains the clean/pushed source requirement, version validation, backup,
migration, rollout, and endpoint checks.

The VPS records the last successful deployment in
`/opt/Anwendungen/flash-n-flip.com/deployments/last-successful`. Failed
deployments print the relevant service logs and backup path. They deliberately
do not restore a database automatically because migration rollback safety must
be assessed for the specific schema change.

## Manual update commands

Run on the server:

```bash
ssh deploy@flash-n-flip.com
cd /opt/Anwendungen/flash-n-flip.com/repo
git fetch origin
git switch main
git pull --ff-only origin main
test "$(git status --porcelain)" = ""
pnpm version:check
```

Record the current commit and create a database backup before changing the
schema. On the first empty deployment, start only PostgreSQL before the first
migration:

```bash
git rev-parse HEAD
cd deploy/production
docker compose up -d postgres
docker compose exec -T postgres \
  pg_dump -U flashcards -d flashcards --format=custom \
  > ../../../backups/flash-n-flip-predeploy.dump
```

Build only the server-side applications and their shared dependencies. The
Docker build deliberately excludes `apps/apple`:

```bash
docker compose build api
docker compose run --rm api pnpm --filter @flashcards/api db:migrate
```

Start or update the private deployment only after the build, backup, and
migration succeed:

```bash
docker compose up -d --remove-orphans
docker compose ps
```

Caddy obtains and renews the certificate for `flash-n-flip.com`. The API and
PostgreSQL are only reachable on the internal Docker network. The admin
service is published exclusively on server loopback at `127.0.0.1:3001`.
The separate connectivity service exposes only STUN Binding on UDP 3478. It is
started with `--stun-only`; TCP, TLS, DTLS, TURN allocation and relay port
ranges remain disabled. Provider and host firewalls must permit inbound UDP
3478 without opening any additional UDP range.

## Verification and rollback

```bash
docker compose exec -T api node -e \
  "fetch('http://127.0.0.1:4000/health').then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)})"

node ../../scripts/probe-stun-only.mjs 127.0.0.1 3478

curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://flash-n-flip.com/api/community/decks

curl --silent --output /dev/null --write-out '%{http_code}\n' \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"test@example.com","password":"not-a-real-password","displayName":"Test","locale":"de","deviceName":"deployment-check","termsVersion":"check","privacyVersion":"check"}' \
  https://flash-n-flip.com/api/auth/register
```

The health request must succeed, the unauthenticated community request must
return `401`, and registration must return `403`. Verify an admin-created
account with its start PIN, the mandatory password change, and a subsequent
login with the personal password manually.

Inspect container and TLS logs when a check fails:

```bash
docker compose logs --tail=200 api web caddy
```

On failure, stop the rollout, restore the previous reviewed commit and image,
then run `docker compose up -d`. Restore the database backup if the applied
migration is not backward compatible.
