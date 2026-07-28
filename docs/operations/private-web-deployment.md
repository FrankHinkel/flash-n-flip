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
AUTH_ALLOWED_EMAIL_DOMAINS=hi-sys.de
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

The account that already owns the private data must have an address ending
exactly in `@hi-sys.de`. Public registration stays disabled. Do not enable it
temporarily on an Internet-facing API to provision an account.

## Update commands

Run on the server:

```bash
ssh deploy@flash-n-flip.com
cd /opt/Anwendungen/flash-n-flip.com/repo
git fetch origin
git switch codex/v0.5.x
git pull --ff-only origin codex/v0.5.x
test "$(git status --porcelain)" = ""
test "$(node -p "require('./package.json').version")" = "0.5.31"
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
Docker build deliberately excludes `apps/mobile`:

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

## Verification and rollback

```bash
docker compose exec -T api node -e \
  "fetch('http://127.0.0.1:4000/health').then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)})"

curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://flash-n-flip.com/api/community/decks

curl --silent --output /dev/null --write-out '%{http_code}\n' \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"test@hi-sys.de","password":"not-a-real-password","displayName":"Test","locale":"de","deviceName":"deployment-check","termsVersion":"check","privacyVersion":"check"}' \
  https://flash-n-flip.com/api/auth/register
```

The health request must succeed, the unauthenticated community request must
return `401`, and registration must return `403`. Verify a real `@hi-sys.de`
login in the browser manually. Addresses outside the configured domain must
receive the same generic invalid-credentials response as an incorrect
password.

Inspect container and TLS logs when a check fails:

```bash
docker compose logs --tail=200 api web caddy
```

On failure, stop the rollout, restore the previous reviewed commit and image,
then run `docker compose up -d`. Restore the database backup if the applied
migration is not backward compatible.
