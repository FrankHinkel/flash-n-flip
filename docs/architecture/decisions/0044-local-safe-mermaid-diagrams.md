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

Mermaid diagrams are stored as a versioned `mermaidDiagram` domain block with
an explicitly declared allowlisted diagram type, bounded source, visible label
and required screen-reader description. Authored SVG is still forbidden.

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

The source block remains authoritative. Render errors preserve label,
description and source as an inert fallback. Derived rendering is not synced
and may be regenerated. Local peer protocol generation 12 makes the expanded
card wire schema explicit; older peers must update rather than silently drop
the block.

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
