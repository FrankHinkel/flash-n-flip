# Flash-n-Flip

**Flash, Flip and Remember.**

Flash-n-Flip is an English-first, bilingual (EN/DE), offline-first learning
platform for iOS, Android, and Web with FSRS scheduling and an admin-approved
community library.

Product website: [flash-n-flip.com](https://flash-n-flip.com)

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
- `packages/i18n`: English-led matching product vocabulary for English and German

## Protected deck packages

Private decks can be exported and restored as account-bound `.fnfdeck`
packages. The package keeps multilingual structured content, internal
navigation and media while excluding learning progress. It is encrypted with
AES-256-GCM and signed with Ed25519; import verifies the authenticated account,
signature, hashes and canonical content schemas before persistence.

Production deployments must set and securely back up an independent,
high-entropy `FNF_DECK_MASTER_SECRET`. See
`docs/formats/fnfdeck-v1.md` for the format and its explicit copy-protection
limitations.

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

The Web and moderation apps use their same-origin `/api` proxy by default.
This also keeps API requests working when a development instance is opened
from another device on the local network. `API_INTERNAL_URL` configures the
server-side proxy target; mobile clients continue to need a directly reachable
`EXPO_PUBLIC_API_URL`.

## Verification

```bash
pnpm check
pnpm --filter @flashcards/mobile exec expo install --check
pnpm --filter @flashcards/api db:migrate
pnpm --filter @flashcards/api smoke
pnpm release:check
```

## Development versions

The `codex/v0.5.x` development branch starts at `0.5.0`. Every later push to
that branch must increase the patch version by exactly `0.0.1`.

```bash
pnpm hooks:install
pnpm version:check
pnpm version:bump
```

The version is kept in sync across the root workspace, all application and
internal package manifests, and the Expo app configuration. The repository
pre-push hook rejects a push to a `codex/v<major>.<minor>.x` development branch
unless the committed version is the next patch after the remote version.

## Brand assets

`Ressourcen/Flash-n-Flip.svg` is the canonical source for the Flash-n-Flip
logo. Replace that file when the artwork changes, then regenerate every Web,
Admin, iOS and Android icon with:

```bash
pnpm assets:brand
```

The generator validates and sanitizes the SVG, creates the required PNG sizes,
extracts its yellow, navy, and blue base colors, and only rewrites changed
files. It generates the shared CSS variables in
`packages/design/src/brand-theme.css`, including automatic system dark mode and
explicit `data-theme="bright"`, `data-theme="light"`, and `data-theme="dark"`
overrides. The matching native palette is generated in
`packages/design/src/brand-theme.ts`.

`pnpm assets:brand:check` fails when generated assets or color themes no longer
match the source. Root-level development and build commands run the generator
automatically.

## Lucide icons as SVG assets

UI icons use Lucide components. For trusted, code-owned drawings an icon can
also be imported from the version-matched `lucide-static` package:

```bash
pnpm assets:lucide sun-moon book-open
pnpm assets:lucide:check
pnpm assets:lucide:test
```

The importer validates the requested names and SVG markup, then writes the
assets to `packages/design/assets/lucide`. Store the Lucide icon name in
structured content; do not store or accept arbitrary SVG markup from users.

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
