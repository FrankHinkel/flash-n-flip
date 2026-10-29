# ABC playback without A/B controls

Removed the temporary A/B buttons, marker state, navigation/playback range
limits, unused range helpers and styles, and dedicated translation entries.
Updated the four-language help text. Playback uses the complete score timeline;
the six existing playback controls and piano-key highlighting remain.

Verification:

- 58 Web tests passed, covering music rendering/security, playback, keyboard
  highlights, Markdown parsing, help, and the simplified player. Behavioral
  tests navigate to the final event, play from a selected measure, and replay
  from the beginning after completion.
- 20 domain ABC validation tests and 18 i18n tests passed.
- Web TypeScript check, local-only Apple Web bundle build, content-security
  check, and `git diff --check` passed.
- Local real-app flow: created and saved an ABC card with eight notes in two
  measures; opened learning; advanced by measure and note; returned to the
  beginning; played through note 8 of 8; restarted at note 1; stopped playback.
  Six playback buttons and zero A/B controls were present throughout.

Rendered study-layout measurements passed the layout checker:

| State                | CSS viewport | Card size       | Padding | Document height |
| -------------------- | ------------ | --------------- | ------- | --------------- |
| Desktop, bright/dark | 1600 x 900   | 1516.01 x 820   | 14 px   | 900             |
| Phone width, dark    | 390 x 844    | 370 x 696.75    | 14 px   | 844             |
| Short viewport, dark | 1024 x 520   | 939.76 x 446.01 | 10 px   | 520             |

Overlap checks passed after classifying the intentional sticky player dock and
the notation's inner scroll container. Raw phone measurements initially flagged
the figure extending 3.53 px below the card and the dock overlapping the canvas
by 5.52 px. Inspection confirmed `.study-card-main` is the intended vertical
scroll area (668 px client height, 698 px scroll height); the sticky dock and all
six controls remain inside the card. The full scrolling figure is therefore not
required to fit the card at once. No CSS workaround was added for these expected
scroll/sticky relationships.

Readability scan: zero static failures, 325 repository-wide review items.
This change removes controls and does not change the remaining controls' colors,
typography, or focus styles. Bright/dark and compact rendered states were checked.

Native installation and device verification remain with the user, as requested.
Actual iOS-on-Mac/iPhone/iPad interaction, VoiceOver, largest native text sizes,
200% browser zoom, answer states, and map-deck coverage are **offen**. No complete
platform-parity or release-readiness claim is made.
