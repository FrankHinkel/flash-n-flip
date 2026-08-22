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
bounded source, generated visible label and screen-reader description.
Authored SVG is still forbidden. Existing structured diagram blocks remain
readable and are converted back to fenced Markdown when edited.

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
