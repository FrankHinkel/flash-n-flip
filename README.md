# Flash-n-Flip

**Flash, Flip and Remember.**

> This checkout is the Apple-first, local-first migration workspace. The
> existing production checkout at `/Users/frank/Documents/FlashCards` remains
> the untouched legacy reference. See
> [`docs/migration/apple-local-first.md`](docs/migration/apple-local-first.md)
> and [ADR 0018](docs/architecture/decisions/0018-local-first-capacitor-vps-sync.md).

Flash-n-Flip is an English-first, bilingual (EN/DE), offline-first learning
platform for iOS, Android, and Web with FSRS scheduling and an admin-approved
community library.

Product website: [flash-n-flip.com](https://flash-n-flip.com)

## Applications

- `apps/apple`: Capacitor shell and the generated iOS/iPadOS Xcode project
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

## Protected collection packages

Private collections can be exported and restored as account-bound `.fnf`
packages. A leaf deck is a one-node collection. The ZIP payload keeps the deck
hierarchy, notes, safe templates, multilingual structured content, internal
navigation and media while excluding learning progress. The ZIP is then
encrypted with AES-256-GCM and signed with Ed25519; import verifies the
authenticated account, signature, hashes and canonical content schemas before
persistence.

Production deployments must set and securely back up an independent,
high-entropy `FNF_DECK_MASTER_SECRET`. See
`docs/formats/fnf-v2.md` for the format and its explicit copy-protection
limitations.

## Local setup

The complete local test environment can be started with one command:

```bash
./flashnflipStart.sh
```

The script checks Node.js, pnpm and Docker, creates a local `.env` when needed,
installs dependencies, starts PostgreSQL, applies migrations and launches the
Web, administration, and API applications. By default, a PostgreSQL container started by the script is
stopped again when the development environment exits. Use
`./flashnflipStart.sh --keep-db` to keep it running.

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
server-side proxy target. The Web app derives its allowed Next.js development
origins from the host's active IPv4 interfaces. `./flashnflipStart.sh` prints the
current LAN URL for the Capacitor WebView, an iPad, or a second computer.

To run the existing Web UI in the iPhone/iPad simulator, keep the local stack
running and synchronize the native project with a reachable URL:

```bash
CAPACITOR_SERVER_URL=http://127.0.0.1:3000 pnpm apple:sync
pnpm apple:open
```

The default native configuration loads `https://flash-n-flip.com`. This is the
UI migration bridge, not the final offline release: user-visible flows move to
the bundled shell and native SQLite one by one before App Store distribution.

The current production Web deployment is invitation-only: public registration
is disabled, administrators create learner accounts with a six-digit start PIN,
and unauthenticated users only reach the login experience. The PIN must be
replaced with a personal password during the first sign-in. Deployment commands
are documented in
[`docs/operations/private-web-deployment.md`](docs/operations/private-web-deployment.md).
For a repeatable VPS update, preview and then run the maintained deployment
script:

```bash
./flashnflipDeployVPS.sh --dry-run
./flashnflipDeployVPS.sh
```

Für einen ausdrücklich freigegebenen privaten Rollout trotz bekannter
Release-/Legal-Blocker steht der kurze Wrapper
`./flashnflipDeployNoBlock.sh` bereit. Er überspringt keine technischen
Quell-, Backup-, Migrations- oder Health-Prüfungen.

### Moderation access

The administration application listens only on `127.0.0.1:3001`. It provides
moderation and invited-account management and uses a random 256-bit access
password instead of manually assigning an `ADMIN` role in PostgreSQL. In local
development, display the password with:

```bash
./flashnflipAdminAccess.sh
```

Then open `http://127.0.0.1:3001` and enter the displayed password. The API
creates the password file on first start and stores it outside version control
with mode `0600`.

For a remote server, keep port `3001` bound exclusively to the server's
loopback interface and do not publish it through the public reverse proxy. From
the workstation, open the SSH tunnel with:

```bash
./flashnflipAdminTunnel.sh
```

The script establishes `127.0.0.1:3001` on the workstation, reads the access
password through the same SSH connection, prints it, opens the moderation page,
and keeps the tunnel alive until Enter or `Ctrl+C`. Host, user, ports, and
remote directory can be configured in the non-versioned `.env` using
`FNF_SSH_HOST`, `FNF_SSH_USER`, `FNF_ADMIN_LOCAL_PORT`, `FNF_ADMIN_PORT`, and
`FNF_REMOTE_DIR`. They can also be supplied as the first three arguments:

```bash
./flashnflipAdminTunnel.sh vps.example.net deploy 3011
```

When containers are used, publish the admin service only as
`127.0.0.1:${FNF_ADMIN_PORT:-3001}:3001` and mount the configured
`FNF_ADMIN_ACCESS_PASSWORD_FILE` into the API container. Admin browser tokens
are kept in `sessionStorage` and disappear when the tab is closed. See
`docs/architecture/decisions/0007-local-admin-tunnel-access.md` for the
security boundary and the current single-operator limitation.

## Verification

```bash
pnpm check
pnpm --filter @flashcards/apple ios:sync
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
internal package manifests, including the Capacitor app package. The repository
pre-push hook rejects a push to a `codex/v<major>.<minor>.x` development branch
unless the committed version is the next patch after the remote version.

## Brand assets

`Ressourcen/Flash-n-Flip.svg` is the canonical source for the Flash-n-Flip
logo. Replace that file when the artwork changes, then regenerate every Web,
Admin and iOS icon with:

```bash
pnpm assets:brand
```

The generator validates and sanitizes the SVG, creates the required PNG sizes,
extracts its yellow, navy, and blue base colors, and only rewrites changed
files. It generates the shared CSS variables in
`packages/design/src/brand-theme.css`, including the bright and dark palettes
used by the explicit two-state appearance toggle. The matching native palette
is generated in
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

`pnpm build` creates production builds for the API, both Next.js apps, and
synchronizes the Capacitor iOS project. Open the signed native project with:

```bash
pnpm apple:open
```

The legal, hosting, retention, email-delivery, and Apple signing placeholders
intentionally block a public release. See
`docs/IMPLEMENTATION_STATUS.md`, `docs/ROADMAP_V1.md`, and
`docs/operations/release-runbook.md`.
