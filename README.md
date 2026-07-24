# FlashCards

FlashCards is an offline-first learning platform for iOS, Android, and Web with
FSRS scheduling and an admin-approved community library.

## Applications

- `apps/mobile`: Expo and React Native
- `apps/web`: Next.js learner and community experience
- `apps/admin`: Next.js moderation console
- `apps/api`: Fastify API backed by PostgreSQL

## Shared packages

- `packages/domain`: canonical schemas and content policy
- `packages/scheduler`: deterministic FSRS integration
- `packages/sync`: idempotent outbox and cursor protocol
- `packages/api-client`: typed API client
- `packages/design`: visual tokens shared across platforms
- `packages/i18n`: matching German and English product vocabulary

## Local setup

The complete local test environment can be started with one command:

```bash
./flashStart.sh
```

The script checks Node.js, pnpm and Docker, creates a local `.env` when needed,
installs dependencies, starts PostgreSQL, applies migrations and launches all
four applications. By default, a PostgreSQL container started by the script is
stopped again when the development environment exits. Use
`./flashStart.sh --keep-db` to keep it running.

The equivalent manual setup is:

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and replace development secrets.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Run database migrations with `pnpm --filter @flashcards/api db:migrate`.
5. Start all applications with `pnpm dev`.

The apps are available at:

- learner web: `http://127.0.0.1:3000`
- moderation: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:4000`

## Verification

```bash
pnpm check
pnpm --filter @flashcards/mobile exec expo install --check
pnpm --filter @flashcards/api db:migrate
pnpm --filter @flashcards/api smoke
pnpm release:check
```

`pnpm build` creates production builds for the API, both Next.js apps and Expo
bundles for iOS, Android, and Web. Signed mobile store binaries are generated
with EAS:

```bash
pnpm --filter @flashcards/mobile exec eas build --platform ios
pnpm --filter @flashcards/mobile exec eas build --platform android
```

The legal, hosting, retention, email-delivery, and EAS project placeholders
intentionally block a public release. See
`docs/IMPLEMENTATION_STATUS.md`, `docs/ROADMAP_V1.md`, and
`docs/operations/release-runbook.md`.
