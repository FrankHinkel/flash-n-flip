type ContainsEventTarget = (target: EventTarget) => boolean;

export function shouldDismissStudyPopupOnBlur(
  containsTarget: ContainsEventTarget,
  relatedTarget: EventTarget | null,
  focusMovedToAncestor = false,
): boolean {
  // iOS may focus the containing card when an option is tapped. Closing on
  // that blur removes the option before its click can select it. Outside taps
  // still dismiss through pointerdown; keyboard focus to a sibling also closes.
  return (
    relatedTarget !== null &&
    !focusMovedToAncestor &&
    !containsTarget(relatedTarget)
  );
}

export function shouldDismissStudyPopupOnPointerDown(
  containsTarget: ContainsEventTarget,
  pointerTarget: EventTarget | null,
): boolean {
  return pointerTarget !== null && !containsTarget(pointerTarget);
}
