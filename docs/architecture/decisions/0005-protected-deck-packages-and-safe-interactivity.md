# ADR 0005: Protected deck packages and safe interactivity

## Status

Accepted, 26 July 2026.

## Decision

Flash-n-Flip uses an account-bound private content package. ADR 0020 supersedes
the original version-1 deck envelope with the ZIP-based `.fnf` collection
package. The API remains the only component that encrypts, decrypts, signs,
verifies and persists a package.

Rich cards remain a discriminated union in `@flashcards/domain`. Video refers
to validated private media. Animation uses a small declarative preset set.
Trusted graphics use app-owned identifiers. The Europe map uses app-owned
Natural Earth geometry and receives only country codes, highlight state and
card navigation targets from deck content.

Web and Mobile implement platform-specific renderers for the same canonical
blocks. Neither renderer executes package-provided code.

## Rationale

Encrypting an ordinary ZIP with a shared application key would expose every
deck once that key was recovered. Password-only protection would make sharing
the password equivalent to sharing the deck. Account-specific key wrapping
keeps exported packages useful as private backups without placing a reusable
decryption secret in Web or Mobile.

App-owned interaction components preserve keyboard, screen-reader, touch target,
theme and reduced-motion behavior. They also prevent raw SVG or animation
scripts from bypassing the content policy.

## Consequences

- Cross-account distribution needs a later entitlement and per-recipient key
  envelope; version 1 intentionally rejects it.
- Deployment secret backup and rotation become operational requirements.
- Community revisions remain separate from private package ownership and from
  learner progress.
- Content capture by an authorized viewer remains possible and is documented
  rather than hidden behind an absolute DRM claim.

## Map data

The generated Europe geometry is based on Natural Earth Admin 0 Countries
1:10m, which Natural Earth publishes as public-domain data:

- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- https://www.naturalearthdata.com/about/terms-of-use/

The template explicitly contains 51 entries, including Kosovo and selected
transcontinental states. The scope is recorded in the generated country file
instead of being inferred from shifting political group membership.

Regenerate the localized country records and map geometry with
`pnpm data:europe`. The script downloads the public-domain source unless a
local GeoJSON path is passed explicitly.
