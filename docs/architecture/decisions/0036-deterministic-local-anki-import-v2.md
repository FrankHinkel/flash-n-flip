# ADR 0036: Deterministic local Anki import V2

## Status

Accepted.

## Context

ADR 0027 introduced declarative import profiles, but treating profiles as the
normal import path does not scale to the large and continuously changing Anki
ecosystem. Anki packages already contain the note types, fields and templates
needed to generate their cards. Flash-n-Flip must use that source structure by
default and reserve profiles for explicit correction.

## Decision

- The canonical analysis, profile, dry-run and import-identity contracts live
  in `packages/domain`. Platform adapters only read archives/databases, stage
  media and commit to IndexedDB or SQLite.
- The normal path renders each used Anki card from its own note type and source
  template. It preserves source card multiplicity, deck assignment, template
  identity, tags, sanitized note fields and referenced local media.
- The bounded renderer supports nested positive/inverse sections, common Anki
  filters, cloze and special fields. Unknown filters are inert and visible;
  JavaScript, event handlers, remote resources and add-on execution are never
  compatibility mechanisms.
- Profile V2 matches normalized note-type signatures plus optional source-deck
  and source-template constraints. Conditions remain bounded data; profiles do
  not gain a general expression language.
- Template fields compile to typed inert slots. Sanitized source content is
  inserted as structured text or media and is never reparsed as source syntax.
- Generated entities use a durable import lineage plus source deck, Anki note
  GUID, rule and output identity. An exact reimport is a no-op; an update keeps
  stable card IDs and study state; a copy receives a new lineage.
- Import planning is side-effect free. Media and mutations are staged before a
  single activation transaction. Interrupted staging remains invisible and is
  recoverable or removable.
- User profiles are private versioned local entities. Export/import is
  validated by the same domain schema. Trusted peer sync uses the normal
  outbox and explicit version conflicts; the VPS receives no profile content.
- Manual field mapping and V2 profiles are explicitly selected correction
  paths. Flash-n-Flip does not ship package-specific profiles for ordinary
  decks. Xefjord and image occlusion remain narrow reviewed structural
  adapters.
- Legacy server imports remain until real Web and Apple parity is demonstrated.

## Consequences

The importer can cover unfamiliar decks without prior registration, while
remaining reproducible and safe to rerun. A 90 percent compatibility claim
requires a representative structural corpus and real rendered-card evidence;
it cannot be derived from unit tests or a few named decks. Large packages may
require a native Apple streaming adapter, and passing browser tests is not
sufficient device evidence.
