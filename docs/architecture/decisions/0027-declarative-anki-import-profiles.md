# ADR 0027: Declarative Anki import profiles

## Status

Accepted.

## Context

The original APKG importer mapped fields to a fixed set of Flash-n-Flip roles.
Xefjord packages used a separate endpoint with reviewed but hard-coded mapping,
language, hierarchy, and grouping behavior. Users need to reproduce similarly
complex imports and generate several cards from one Anki note without executing
Anki templates or custom scripts.

## Decision

- APKG analysis and commit remain the only Anki import transport. Xefjord is a
  versioned built-in profile selected through the standard commit endpoint.
- User profiles are versioned declarative data stored local-first in IndexedDB.
  The selected immutable profile snapshot is sent with an import commit and is
  validated again by the API.
- Rules match note types by normalized name and required field names instead of
  unstable Anki note-type identifiers.
- Every matching rule can generate several output cards. Each output owns a
  question template, an answer template, a language direction, optional
  non-empty field requirements, and an optional link to the preceding output.
- Templates use the existing safe Markdown and Wiki-table syntax. `[[Field]]`
  creates a structural placeholder. The importer parses the template with
  inert placeholder tokens and inserts sanitized field text into the resulting
  document tree. Field values are never reparsed as Markdown, cloze syntax,
  links, HTML, or template code.
- Profile schema, template length, rule count, output count, field references,
  note-type matches, and generated rich-text documents are bounded and
  validated by shared contracts.
- Anki media, SVG, archive, and content sanitization remain importer-owned
  capabilities. Profiles cannot weaken those checks or execute JavaScript,
  CSS, add-ons, raw HTML, file URLs, or external resources.

## Consequences

Users can build tables, clozes, reverse cards, and linked follow-up cards from
arbitrary Anki fields while every platform receives the same structured card
content. Built-in profiles can retain reviewed vendor-specific transformations
without maintaining separate upload or commit routes. Profile synchronization
between devices remains a later settings-sync step; local profiles already
survive browser restarts and the import snapshot makes each server operation
self-contained.
