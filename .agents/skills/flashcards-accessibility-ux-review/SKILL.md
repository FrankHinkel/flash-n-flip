---
name: flashcards-accessibility-ux-review
description: Review visible and interactive FlashCards experiences for accessibility and coherent UX. Use for screens, components, forms, navigation, gestures, editor controls, study ratings, charts, dialogs, errors, responsive layouts, or design-system changes on Web, iOS, and Android.
---

# FlashCards Accessibility UX Review

1. Read `references/accessibility-checklist.md`.
2. For every critical UI change, invoke `$flashcards-readability-contrast-review` and resolve its blockers.
3. Walk the real create, edit, learn, publish, moderate, export, and delete paths.
4. Test keyboard and screen-reader semantics on Web.
5. Test VoiceOver and TalkBack behavior on real devices before release.
6. Report blocked core paths as `Release-Blocker`.

## Mandatory guardrails

- Give every gesture an accessible control alternative.
- Never communicate learning status by color alone.
- Preserve focus across dialogs, validation, navigation, and answer reveal.
- Support text scaling, reduced motion, dark mode, and sufficient contrast.
- Use plain-language labels for FSRS ratings and destructive actions.
- Keep touch targets at least 44 by 44 logical points where practical.
- Provide text alternatives for meaningful images and accessible math output.
