# xml2abc.py 177 provenance and local changes

- Upstream author: W.G. Vree and contributors named in the source header
- Upstream page: <https://wim.vree.org/svgParse/xml2abc.html>
- Download: <https://wim.vree.org/svgParse/xml2abc.py-177.zip>
- Downloaded archive SHA-256:
  `158ae6ac87c34b7f170a7a57712206fac756e0434806e38a280f6fd968c8816d`
- Vendored file: `tools/mxml2abc-convert/vendor/xml2abc.py`
- Modified vendored file SHA-256:
  `801e1c89430560f47477f95cd061d544bf211683cabddd81f90ad0a543f68851`
- Upstream version: 177
- Upstream license declaration: GNU Lesser General Public License; the source
  does not name a version and links to <https://www.gnu.org/licenses/lgpl.html>

Flash-n-Flip modifies the vendored source in four narrow ways:

1. MusicXML numeric fingerings are emitted as ABC above/below text annotations
   instead of numeric decorations, because those annotations are understood by
   FnF's inert ABC profile. Unsupported fingering text is diagnosed and
   discarded.
2. A malformed non-numeric MusicXML tempo is diagnosed and ignored instead of
   raising an unhandled conversion exception.
3. The source encoding declaration is UTF-8 so the fingering substitution
   character in the local patch is interpreted consistently.
4. Trailing whitespace is normalized without changing Python behavior.

The complete modified source is shipped in the repository. See
`docs/licenses/LGPL-3.0.txt` for the bundled license text. Because the upstream
header does not select a numbered LGPL version, the notice records the
license as `LGPL-3.0-or-later` while preserving that exact upstream statement.
