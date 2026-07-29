# ADR 0010: Population-driven Admin-1 geography decks

## Status

Accepted, 29 July 2026.

## Decision

Flash-n-Flip generates an Admin-1 map and installable subdivision deck for
every country whose latest checked-in World Bank population is strictly above
10,000,000.

The Admin-1 generator reads the static `geographyRegions` object from the
checksum-reviewed country artifact through the TypeScript syntax tree. It does
not execute generated source and does not maintain a second country list.
Natural Earth provides the Admin-1 geometry, localized names, and available
regional-capital records. The established identifiers and curated Wikidata
capital assignments for Germany, France, Italy, the United States, and Colombia
remain unchanged.

The generated domain artifact exports the selected countries, map identifiers,
bounds, shapes, regions, and capital markers. The API derives catalog templates
from that shared metadata. Web uses the same metadata for flags and editor map
choices. Clients therefore do not duplicate eligibility or country-to-map
rules.

## Rationale

A manually curated list would drift from the population data displayed by the
same application. Generating all affected contracts from one reviewed snapshot
keeps the threshold, catalog hierarchy, API validation, and rendering aligned.

Parsing a known variable initializer through the TypeScript AST preserves the
existing source-integrity gate without evaluating code or accepting arbitrary
templates.

## Consequences

- A World Bank snapshot update can change the eligible country set. Generated
  diffs and the exact 10,000,000 threshold test must be reviewed before release.
- Country map bounds are derived from all of that country's Admin-1 geometry
  and handle antimeridian crossings.
- Natural Earth does not identify a regional capital for every Admin-1 unit.
  Missing capital data remains absent rather than being guessed.
- The generated subdivision artifact is substantially larger because every
  region path remains local and offline-capable.
