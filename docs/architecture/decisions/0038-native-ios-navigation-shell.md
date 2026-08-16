# ADR 0038: Native iOS navigation shell

- Status: Accepted
- Date: 16 August 2026

## Context

Flash-n-Flip uses the React product interface inside one Capacitor WebView on
iPhone and iPad. The browser and installed PWA provide a five-item Web
navigation. Recreating the current Apple tab-bar appearance in CSS would not
provide the system behavior, accessibility, or forward-compatible visual
material of UIKit.

## Decision

1. The installed Apple application wraps its existing, single
   `FlashNFlipBridgeViewController` in one
   `FlashNFlipNativeShellViewController` containing a standard `UITabBar`.
2. The stable, versioned tab identities are `overview`, `decks`, `study`,
   `discover`, and `local`. React remains the owner of routes and of the last
   valid study URL.
3. Native tab selections are emitted to React through the
   `FlashNFlipNavigation` Capacitor adapter. React changes routes through its
   existing router and reports relevant route changes back to UIKit.
4. Unknown or modal routes retain the last unambiguous tab selection.
5. The native capability is injected at document start. Only a confirmed
   shell hides `.mobile-nav`; browser and PWA presentation remain unchanged.
6. The WebView extends below the native tab bar so system translucency can show
   the underlying product surface. UIKit reports the real tab-bar protection
   inset to the Web layout initially and whenever it changes, without a fixed
   Web pixel estimate.
7. The overview tab symbol is a monochrome template asset generated from the
   same canonical SVG geometry as the colored application icon. Other tabs use
   SF Symbols and all five retain visible labels.
8. The optional local-connection status is exposed as an accessibility value.
   Tab selection never starts synchronization, import, or another background
   operation.

## Dependency boundary

UIKit, WebKit, and Capacitor remain in `apps/apple`. The small Web adapter and
route mapping remain in `apps/web`; domain, scheduler, import, persistence, and
synchronization packages do not import platform APIs.

## Consequences

- There is still exactly one WebView, JavaScript context, local database
  authority, and sync runtime.
- Native and Web navigation must remain synchronized in both directions.
- Standard UIKit supplies light, dark, reduced-transparency, contrast, safe
  area, and future system-material behavior.
- A rollback can restore the bridge controller as root. Its native-shell flag
  defaults to disabled, so the unchanged Web navigation reappears.
- Physical-device VoiceOver, Dynamic Type, orientation, iPad Split View, and
  current/older iOS visual acceptance remain release gates.

## Rejected alternatives

- Five tab child controllers: they risk five WebViews and duplicated local
  initialization.
- Direct native history manipulation or document reloads: React owns routing.
- User-agent or width detection: neither proves that a native shell exists.
- Custom glass or blur rendering: it duplicates system material behavior.
- A separately drawn logo: it can drift from the application mark.

## Verification gates

- Contract and structure tests prove stable IDs, route mapping, one bridge
  child, plugin registration, template-symbol generation, and Web-only
  fallback.
- Web and Apple builds must pass, followed by an unsigned simulator Xcode
  build.
- A physical iPhone/iPad acceptance run must verify navigation, VoiceOver,
  enlarged text, light/dark appearance, learning controls, import, audio,
  SQLite, and direct device synchronization before public release.

## References

- ADR 0018: Local-first application with Capacitor and VPS synchronization
- ADR 0037: Installed application runtime boundary
- `ios-native-menu.md`
