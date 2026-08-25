"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import {
  mediaPresentationLengthCss,
  mediaPresentationPercentHeightPx,
  type MediaPresentationLength,
} from "./media-presentation";

const referenceSelector = [
  ".editor-preview article",
  ".editor-live-preview",
  "[data-study-card]",
].join(",");

export function useMediaPresentationHeight(
  elementRef: RefObject<HTMLElement | null>,
  height: MediaPresentationLength,
): string {
  const [resolved, setResolved] = useState(() =>
    height.unit === "percent"
      ? `${height.value}dvh`
      : mediaPresentationLengthCss(height),
  );

  useLayoutEffect(() => {
    if (height.unit !== "percent") {
      setResolved(mediaPresentationLengthCss(height));
      return;
    }
    const element = elementRef.current;
    if (!element) return;
    const reference = element.closest<HTMLElement>(referenceSelector);
    const update = () => {
      const referenceHeight =
        reference?.clientHeight ||
        window.visualViewport?.height ||
        window.innerHeight;
      setResolved(
        `${mediaPresentationPercentHeightPx(height.value, referenceHeight)}px`,
      );
    };
    update();
    const observer =
      reference && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (observer && reference) observer.observe(reference);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [elementRef, height.unit, height.value]);

  return resolved;
}
