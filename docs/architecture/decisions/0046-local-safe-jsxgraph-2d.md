# ADR 0046: Local, declarative JSXGraph 2D constructions

- Status: Accepted
- Date: 2026-08-24

## Context

Flash-n-Flip needs interactive mathematical drawings for geometry, analysis and
vector-field learning cards. JSXGraph exposes the required 2D renderer, but its
native JavaScript API cannot be accepted as authored card content. Cards are
imported, persisted, exported and synchronized between trusted devices, so
arbitrary script or externally loaded content would cross every content
boundary.

## Decision

Authors use fenced `jsxgraph` or `jxg` blocks in the normal question or answer
field. A line-oriented, versioned Flash-n-Flip language describes the board,
named objects and mathematical expressions. It is parsed into a domain-owned
AST. It is never evaluated as JavaScript, JessieCode, HTML or CSS.

Every construction requires a quoted `describe` directive. An optional quoted
`title` supplies the accessible label. The domain allowlists syntax, object
types, expression functions, element properties and style attributes. It also
enforces 30,000 source characters, 250 statements, 150 rendered objects, 24
sliders and 5,000 expression nodes. URLs, external data, executable vocabulary,
HTML, images, active controls, prototype properties and all 3D object names are
rejected before the renderer is loaded.

The domain package owns parsing, validation, the structured `jsxGraph` block and
sync schema. The Web/Capacitor adapter owns JSXGraph 1.13.1 and translates the
validated AST into explicit `board.create` calls. Function values use a bounded
interpreter implemented by Flash-n-Flip; neither `eval` nor `Function` is used.
The renderer is bundled locally, uses SVG, disables JSXGraph navigation and
copyright controls, and does not contact a CDN or VPS.

The source remains authoritative. The live preview and study card render a
derived interactive board. Invalid or unsupported input stays inert code. The
short Mermaid-compatible metadata `{w=90% h=70% bg=#18212f80}` controls only
bounded width, viewport-relative or pixel height, and hexadecimal background.

Mouse, trackpad and touch gestures operate inside the board. Two-finger touch
leaves one-finger page scrolling available. A collapsed information control
contains the required description and keyboard-accessible zoom/reset controls.
Movable JSXGraph elements retain keyboard support. The board is responsive and
has a fixed-height mobile fallback.

Adding the structured block changes synchronized card payloads, therefore local
peer protocol generation 17 is required. A peer with an earlier generation must
upgrade instead of silently dropping the construction.

## Consequences

- Geometry, interactive points and sliders, function graphs, parametric, polar
  and implicit curves, inequalities, numerical integral helpers, Riemann sums,
  vector fields and slope fields work locally in cards.
- The allowlist also covers reproducible seeded starting values, Lagrange
  interpolation, dynamic integral bounds, bounded Riemann methods, point
  traces/trace curves, point faces and sizes, and separate stroke/fill opacity.
  Trace cleanup is exposed through the existing collapsed accessible controls,
  not through JSXGraph's navigation chrome.
- Authored code cannot call the native JSXGraph API or load remote resources.
- Unsupported native JSXGraph features require an explicit DSL/parser/adapter
  extension with security and accessibility tests.
- 3D is intentionally not part of schema version 1 and is rejected.

## Deferred 3D extension

A later decision may introduce a separate `jsxgraph3d` fence and schema version,
never an implicit upgrade of a 2D block. It must define a camera/view statement,
an independent allowlist for `view3d`, points, lines, curves, planes and surfaces,
bounded mesh/sample counts, deterministic clipping and a non-visual textual
model. Touch rotation must coexist with page scrolling and zoom, and reduced
motion, keyboard navigation, contrast, performance and WebView memory need real
iPhone/iPad acceptance before enabling it.

## Verification

Parser tests cover valid examples, dependencies, expression complexity, object
limits, 3D rejection and malicious input. Content tests cover Markdown,
structured blocks, direct editing, inert fallback and local peer fingerprints.
The production Web and portable Apple Webstack builds confirm local bundling.
Responsive browser checks cover desktop, iPhone width, short height and 200%
zoom; a real iOS WebView remains an acceptance gate for release claims.
