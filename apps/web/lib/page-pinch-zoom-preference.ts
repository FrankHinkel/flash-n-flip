export const pagePinchZoomPreferenceKey = "flash-n-flip.page-pinch-zoom.v1";
export const pagePinchZoomPreferenceChangedEvent =
  "flash-n-flip:page-pinch-zoom-preference";

export function parsePagePinchZoomPreference(
  storedValue: string | null,
): boolean {
  return storedValue === "enabled";
}

export function shouldPreventPagePinchZoom(
  enabled: boolean,
  insideDedicatedZoomArea: boolean,
): boolean {
  return !enabled && !insideDedicatedZoomArea;
}

export function getPagePinchZoomPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return parsePagePinchZoomPreference(
      window.localStorage.getItem(pagePinchZoomPreferenceKey),
    );
  } catch {
    return false;
  }
}

export function setPagePinchZoomPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      pagePinchZoomPreferenceKey,
      enabled ? "enabled" : "disabled",
    );
  } catch {
    return;
  }
  window.dispatchEvent(new Event(pagePinchZoomPreferenceChangedEvent));
}
