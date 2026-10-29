# Complete Markdown fences in Help copy examples

ABC, Mermaid and JSXGraph reference examples now display a complete Markdown
block under “Source to copy”: opening backticks, language, presentation options,
unchanged example source, and closing backticks. The preview and copy section use
the same generated snippet. An outer tilde text fence presents that snippet as
literal text while the existing copy button copies its complete contents.

The signed catalog was regenerated. Only the Help collection changed; collection
and card identifiers are retained. The existing automatic Help refresh applies
the changed hashes at startup after the new app bundle is installed.

Verification:

- 69 Help service tests passed. Every one of the 60 examples was parsed from its
  actual generated Help card; its copy block equals the complete expected
  Markdown and parses back to the same preview node, including options.
- 55 Web copy/content tests passed, including literal display of all three fence
  types, complete clipboard-call payloads, line breaks, errors and retry.
- Three signed-catalog/parity tests and two automatic Help update tests passed.
- API/Web TypeScript checks, catalog reproducibility/signature check, local-only
  Apple Web bundle build, content-security check and `git diff --check` passed.
- Real local app: the automatically refreshed Help displayed complete fences for
  ABC scale, Mermaid flowchart and JSXGraph triangle examples. Each copy button
  reported success. The visible snippets were pasted unchanged into the card
  editor, where actual score, Mermaid SVG and JSXGraph SVG previews appeared.

The browser-control tool's virtual clipboard could not transfer the page-written
clipboard between test tabs. Therefore that UI paste step used the visible
snippet through the tool's text-paste API. The exact copy-button payload is
verified by behavioral tests, rather than claimed as a successful native
cross-tab clipboard read. Installed Mac clipboard acceptance remains with the
user; no new native clipboard code was needed.
