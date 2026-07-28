# Private Web deployment

This procedure deploys the Web, API, and localhost-only admin applications.
It does not build, sign, or publish the iOS and Android applications.

## Required production configuration

Keep the production `.env` outside version control with mode `0600`. At
minimum, verify these values:

```dotenv
NODE_ENV=production
AUTH_ALLOWED_EMAIL_DOMAINS=hi-sys.de
PUBLIC_REGISTRATION_ENABLED=false
API_HOST=127.0.0.1
API_PORT=4000
API_PUBLIC_URL=https://flash-n-flip.com/api
API_INTERNAL_URL=http://127.0.0.1:4000
ALLOWED_ORIGINS=https://flash-n-flip.com
NEXT_PUBLIC_API_URL=/api
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
cd /opt/Anwendungen/flash-n-flip.com
git fetch origin
git switch codex/v0.5.x
git pull --ff-only origin codex/v0.5.x
corepack enable
pnpm install --frozen-lockfile
pnpm version:check
```

Create an encrypted database backup using the production backup mechanism and
record the current commit before changing the schema:

```bash
git rev-parse HEAD
pnpm --filter @flashcards/api db:migrate
```

Build only the server-side applications and their shared dependencies:

```bash
pnpm assets:brand:check
pnpm exec turbo run build \
  --filter=@flashcards/api \
  --filter=@flashcards/web \
  --filter=@flashcards/admin
```

Restart the existing process supervisor only after the build and migration
succeed. For a systemd installation using the names below:

```bash
sudo systemctl restart flash-n-flip-api flash-n-flip-web flash-n-flip-admin
sudo systemctl --no-pager --full status \
  flash-n-flip-api flash-n-flip-web flash-n-flip-admin
```

If the production services use different unit names, replace only the three
unit names; do not expose the admin service publicly. It must remain bound to
`127.0.0.1:3001`.

## Verification and rollback

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:4000/health

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

On failure, stop the rollout, restore the previous reviewed commit, rebuild,
restart the services, and restore the database backup if the applied migration
is not backward compatible.
