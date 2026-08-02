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

export type PopupVerticalBounds = {
  top: number;
  bottom: number;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function fitPopupToViewport({
  anchor,
  popup,
  viewport,
  verticalBounds,
  margin = 8,
  gap = 6,
}: {
  anchor: PopupRect;
  popup: Pick<PopupRect, "width" | "height">;
  viewport: PopupViewport;
  verticalBounds?: PopupVerticalBounds;
  margin?: number;
  gap?: number;
}): PopupLayout {
  const viewportRight = viewport.left + viewport.width;
  const naturalViewportBottom = viewport.top + viewport.height;
  const viewportTop = Math.max(
    viewport.top,
    verticalBounds?.top ?? viewport.top,
  );
  const viewportBottom = Math.max(
    viewportTop,
    Math.min(
      naturalViewportBottom,
      verticalBounds?.bottom ?? naturalViewportBottom,
    ),
  );
  const availableWidth = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(popup.width, availableWidth);
  const left = clamp(
    anchor.left + anchor.width / 2 - width / 2,
    viewport.left + margin,
    viewportRight - margin - width,
  );
  const boundedAnchorTop = clamp(anchor.top, viewportTop, viewportBottom);
  const boundedAnchorBottom = clamp(anchor.bottom, viewportTop, viewportBottom);
  const belowSpace = Math.max(
    0,
    viewportBottom - margin - boundedAnchorBottom - gap,
  );
  const aboveSpace = Math.max(0, boundedAnchorTop - viewportTop - margin - gap);
  const placement = belowSpace >= aboveSpace ? "below" : "above";
  const availableHeight = placement === "below" ? belowSpace : aboveSpace;
  const maxHeight = Math.min(popup.height, availableHeight);
  const renderedHeight = maxHeight;
  const top =
    placement === "below"
      ? boundedAnchorBottom + gap
      : boundedAnchorTop - gap - renderedHeight;

  return {
    left,
    top: clamp(
      top,
      viewportTop + margin,
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
