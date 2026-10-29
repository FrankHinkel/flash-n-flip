# Mac card selection and copying

Scope: desktop card text selection, the Markdown code copy button, and the
installed Apple app's text-interaction and clipboard adapters.

## Cause and fix

- `.study-page` disabled CSS selection, inherited by card content. Desktop
  pointer input and the explicit Apple Mac platform now enable selection inside
  `.card-content`; the touch-only study policy is retained.
- The native shell disabled `WKPreferences.isTextInteractionEnabled` whenever
  no editable field was visible. Mac now retains text interaction independently
  of input visibility. Existing input-session cleanup and study key commands
  remain in place.
- Code copying depended exclusively on `navigator.clipboard`. A write-only
  Capacitor adapter now writes plain text to `UIPasteboard.general` on the main
  queue. Web and older shells retain the browser API. Failures display the
  existing localized manual-selection hint with `role="alert"`; success is
  displayed only after the write completes.

Apple API references:
[text interaction](https://developer.apple.com/documentation/webkit/wkpreferences/istextinteractionenabled)
and [system pasteboard](https://developer.apple.com/documentation/uikit/uipasteboard).
No clipboard reading, content execution, or network transfer was added.

## Verification

- 59 focused Web tests passed: clipboard routing and failures, complete Unicode
  and multiline payloads, pending/success states, failed copy and retry, content
  rendering, and study question/answer rendering.
- 33 Apple shell/text-entry tests passed, including Mac selection policy and
  write-only clipboard registration. Native policy assertions are structural;
  they do not establish installed-app acceptance.
- Web and Apple TypeScript checks passed; `git diff --check` passed.
- Unsigned Debug iOS build succeeded with Xcode, including compilation of the
  Swift clipboard plugin and rebuilding/copying the local-only Web bundle.
  This is the iOS application used by compatible Apple-silicon Macs.
- Real local portable-app flow: created and saved a card, reopened the app,
  opened learning, dragged across question text, pressed Cmd+C, and pasted the
  exact selection into the deck search field. The copy button's code was also
  pasted into that field, retaining Unicode. Full line-break preservation is
  covered by the behavioral test (the search field is single-line).
- Answer text was selected by a real mouse drag and matched the entire answer.
- Bright/dark rendering was exercised. Readability scan: zero static failures;
  328 repository-wide review items remain outside this narrow acceptance.
- Content-security check passed. Rendering/escaping was not changed.

Measured layout checks, all passed with no document scrolling:

| State               | CSS viewport | Card size       | Padding |
| ------------------- | ------------ | --------------- | ------- |
| Question, bright    | 1600 x 900   | 1516 x 820      | 14 px   |
| Answer, bright/dark | 1600 x 900   | 1516 x 820      | 14 px   |
| Answer, dark        | 390 x 844    | 370 x 696.75    | 14 px   |
| Answer, dark, short | 1024 x 520   | 939.76 x 446.01 | 10 px   |

The study-layout checker passed these measurements. The desktop answer's card,
code block, copy button, and rating panel also passed the overlap checker.
The copy button measured approximately 44 x 44 CSS px.

## Open acceptance and unrelated failures

Installed iOS-on-Mac selection, Cmd+C, native pasteboard writing, and keyboard
navigation after selecting text remain **offen**: direct computer-use access to
the installed Mac app failed. The successful build has not been installed or
distributed. Actual iPhone/iPad WebView interaction, enlarged native text,
200% browser zoom, map-deck states, and screen-reader behavior remain **offen**.
No complete UI-parity or release-readiness claim is made.

An accidentally broad Web run also exposed two failures in
`study-deck-popup-layout.test.ts` and a native-engine startup timeout. The timeout
passed on focused rerun; both popup assertions still fail. Both expected CSS
rules are already absent in HEAD, independently of this selection-only CSS
addition. Those unrelated layout rules were not changed.
