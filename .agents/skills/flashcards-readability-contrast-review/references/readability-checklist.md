# Readability and contrast checklist

## Scope

- List the changed routes, components, shared tokens, platforms, and user states.
- Mark a change as critical when it affects a core path or any shared color, type, surface, form, navigation, dialog, study, moderation, or publishing component.
- Include inherited colors and downstream components when a shared token changes.

## Automated first pass

- Run `node scripts/check-readability.mjs <repository-root>`.
- Treat `FAIL` as a blocker until the rendered pair is corrected and retested.
- Inspect every `REVIEW` result in the rendered UI. The scanner intentionally reports tiny text, opacity, transparency, gradients, and unresolved pairs that require context.
- Remember that the scanner only proves pairs declared together in source. Inheritance and overlays require rendered inspection.

## Rendered Web and admin checks

- Exercise the actual route at a representative desktop width and at 390 CSS px.
- Check normal and 200% zoom without horizontal loss of essential content.
- Check light and dark appearances when supported.
- Inspect default, hover, focus-visible, active, selected, disabled, loading, error, success, empty, and populated states.
- Read computed foreground, background, opacity, font size, and font weight for every suspicious element.
- Follow backgrounds through transparent ancestors until reaching an opaque surface.
- For gradients and images, measure the weakest point behind each text line.

## Rendered iOS and Android checks

- Test the affected screen on both platforms or document the unavailable platform as externally blocked.
- Test the largest supported accessibility text size.
- Check text wrapping, truncation, clipping, overlap, and action reachability.
- Inspect default, pressed, focused, selected, disabled, loading, validation, and offline states.
- Verify system contrast or color settings do not erase essential state information.

## Thresholds

- Normal text: at least `4.5:1`.
- Large Web text: at least 24 CSS px regular or 18.66 CSS px bold, then at least `3:1`.
- Large native text: at least 18 pt regular or 14 pt bold, then at least `3:1`.
- Control boundaries, meaningful icons, focus, and state indicators: at least `3:1` against adjacent colors.
- Product rule: placeholders, helper text, metadata, errors, and informative disabled text remain readable; low opacity is not a substitute for hierarchy.
- Ratios are thresholds and must not be rounded up.

## Report format

For every failure or unresolved review item record:

- Severity: `Release-Blocker`, `hoch`, `mittel`, or `Review erforderlich`.
- Platform, route, viewport or text-size setting.
- Component or selector and interaction state.
- Foreground, effective background, font size, weight, and measured ratio.
- User impact and concrete remediation.
- Retest evidence after correction.

Finish with one of:

- `bestanden`: all affected rendered states meet the rules.
- `bedingt bestanden`: no blocker remains, but named non-critical review items are open.
- `nicht bestanden`: at least one blocker remains.
