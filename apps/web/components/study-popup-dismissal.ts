type ContainsEventTarget = (target: EventTarget) => boolean;

export function shouldDismissStudyPopupOnBlur(
  containsTarget: ContainsEventTarget,
  relatedTarget: EventTarget | null,
): boolean {
  return relatedTarget !== null && !containsTarget(relatedTarget);
}

export function shouldDismissStudyPopupOnPointerDown(
  containsTarget: ContainsEventTarget,
  pointerTarget: EventTarget | null,
): boolean {
  return pointerTarget !== null && !containsTarget(pointerTarget);
}
