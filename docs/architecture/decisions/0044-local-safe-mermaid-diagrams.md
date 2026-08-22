# ADR 0044: Local, structured and sanitized Mermaid diagrams

- Status: Accepted
- Date: 2026-08-22

## Context

Cards need locally rendered diagrams without sending private content to an
external renderer. Mermaid accepts a rich user-controlled language and emits
SVG, while the content policy forbids authored SVG and executable templates.
The same card payload is persisted in IndexedDB or SQLite, exported, restored
and replicated between trusted peers.

## Decision

New Mermaid diagrams remain part of the authoritative Markdown source as
fenced `mermaid` code blocks. The normal question or answer field is the only
authoring surface; the opposite live preview and study card derive a temporary
versioned `mermaidDiagram` block with an explicitly declared allowlisted type,
bounded source and a screen-reader label. No generated heading or description
is shown above the diagram.
Authored SVG is still forbidden. Existing structured diagram blocks remain
readable and are converted back to fenced Markdown when edited.

The optional fenced-code metadata uses the deliberately small syntax
`{w=90% h=70% bg=#18212f80}`. Width is limited to 1–100 percent, height to
1–100 percent of the visible height or 120–1200 pixels, and background to CSS hexadecimal colors. Four- and
eight-digit colors carry alpha in their final nibble or byte. Unknown,
duplicated, malformed or out-of-range options keep the fence inert; arbitrary
CSS is never accepted.

The diagram has no generated visual frame or toolbar. Pointer dragging, touch
dragging, mouse-wheel or trackpad zoom, and two-pointer pinch gestures operate
inside the bounded viewport. Keyboard focus provides arrow-key panning,
plus/minus zoom and zero reset as the non-gesture alternative.

The domain package owns the schema, syntax allowlist and complexity limits but
does not import Mermaid. The Web app owns Mermaid 11.17.0 and loads it only for
visible diagram components. Capacitor uses the same bundled adapter. Rendering
uses no CDN, VPS or external service.

App configuration is fixed with strict security, HTML labels disabled and no
automatic document scan. Source directives, links, callbacks, HTML, CSS,
images, icons and external references are rejected before rendering. Renderer
SVG is passed through the shared inert-SVG allowlist; an unexpected element,
attribute, URL or active feature rejects the complete result. Only that
sanitized derived markup may enter the DOM.

The Markdown source remains authoritative. Render errors preserve the source as
an inert code block. Derived rendering is not persisted or synced and may be
regenerated. Local peer protocol generation 12 still recognizes the legacy
structured block so existing cards are not silently dropped.

## Consequences

- Flowchart, sequence, state, class, ER, mindmap and timeline diagrams work
  offline in Web and the Apple Webstack.
- Private diagram source never leaves the device for rendering.
- Diagram blocks survive normal local persistence, export, restore and peer
  replication through the canonical card schema.
- Mermaid upgrades require an explicit dependency update, security fixtures,
  SVG allowlist review and Web/iOS acceptance.
- New diagram types, links, custom styling and interactive learning targets
  remain separate decisions.

## Verification

Domain tests cover every allowed diagram type, declared-type mismatches,
complexity limits and forbidden syntax. Renderer tests cover active SVG,
external references and safe fallback. Editor and ContentView tests cover
creation, preview, accessible text and the requested examples. Production Web
and portable Apple Webstack builds verify that all assets remain local.
