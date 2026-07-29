export type PopupRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type PopupViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PopupLayout = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below";
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function fitPopupToViewport({
  anchor,
  popup,
  viewport,
  margin = 8,
  gap = 6,
}: {
  anchor: PopupRect;
  popup: Pick<PopupRect, "width" | "height">;
  viewport: PopupViewport;
  margin?: number;
  gap?: number;
}): PopupLayout {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  const availableWidth = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(popup.width, availableWidth);
  const left = clamp(
    anchor.left + anchor.width / 2 - width / 2,
    viewport.left + margin,
    viewportRight - margin - width,
  );
  const belowSpace = Math.max(0, viewportBottom - margin - anchor.bottom - gap);
  const aboveSpace = Math.max(0, anchor.top - viewport.top - margin - gap);
  const placement =
    popup.height <= belowSpace || belowSpace >= aboveSpace ? "below" : "above";
  const availableHeight = placement === "below" ? belowSpace : aboveSpace;
  const maxHeight = Math.min(popup.height, availableHeight);
  const renderedHeight = maxHeight;
  const top =
    placement === "below"
      ? anchor.bottom + gap
      : anchor.top - gap - renderedHeight;

  return {
    left,
    top: clamp(
      top,
      viewport.top + margin,
      viewportBottom - margin - renderedHeight,
    ),
    width,
    maxHeight,
    placement,
  };
}

export function popupFitsViewport(
  layout: PopupLayout,
  viewport: PopupViewport,
  margin = 8,
): boolean {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  return (
    layout.left >= viewport.left + margin &&
    layout.top >= viewport.top + margin &&
    layout.left + layout.width <= viewportRight - margin &&
    layout.top + layout.maxHeight <= viewportBottom - margin
  );
}
