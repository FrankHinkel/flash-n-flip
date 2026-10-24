"use client";

import { useLayoutEffect, type RefObject } from "react";

import { fitPopupToViewport } from "./popup-position";

// Keep the menu inside every scroll/clipping ancestor, including the native
// tab bar's reserved viewport. Absolute positioning preserves details' focus
// and outside-tap behavior without moving the menu out of its owner.
export function useStudyPickerPosition(
  ref: RefObject<HTMLDetailsElement | null>,
) {
  useLayoutEffect(() => {
    const details = ref.current;
    const menu = details?.querySelector<HTMLElement>(
      ".study-language-menu, .study-difficulty-menu",
    );
    const summary = details?.querySelector("summary");
    if (!details || !menu || !summary) return;
    const visual = window.visualViewport;
    const update = () => {
      if (!details.open) {
        delete menu.dataset.positioned;
        return;
      }
      let left = visual?.offsetLeft ?? 0;
      let top = visual?.offsetTop ?? 0;
      let right = left + (visual?.width ?? window.innerWidth);
      let bottom = top + (visual?.height ?? window.innerHeight);
      for (
        let parent = details.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          left = Math.max(left, rect.left + parent.clientLeft);
          right = Math.min(
            right,
            rect.left + parent.clientLeft + parent.clientWidth,
          );
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          top = Math.max(top, rect.top + parent.clientTop);
          bottom = Math.min(
            bottom,
            rect.top + parent.clientTop + parent.clientHeight,
          );
        }
      }
      const theme = document.querySelector<HTMLElement>(".study-theme-toggle");
      if (theme && theme.getClientRects().length) {
        // The popup's 8px margin completes the theme control's 10px clearance.
        top = Math.max(top, theme.getBoundingClientRect().bottom + 2);
      }
      const anchor = summary.getBoundingClientRect();
      if (
        right - left < 60 ||
        bottom - top < 60 ||
        anchor.right < left ||
        anchor.left > right ||
        anchor.bottom < top ||
        anchor.top > bottom
      ) {
        details.open = false;
        delete menu.dataset.positioned;
        return;
      }
      menu.style.removeProperty("width");
      menu.style.removeProperty("max-height");
      const width = Math.max(0, right - left);
      // Measure height after wrapping to the available width.
      menu.style.width = `${Math.min(menu.getBoundingClientRect().width, Math.max(0, width - 16))}px`;
      const layout = fitPopupToViewport({
        anchor,
        popup: {
          width: menu.getBoundingClientRect().width,
          height: menu.scrollHeight + menu.offsetHeight - menu.clientHeight,
        },
        viewport: { left, top, width, height: Math.max(0, bottom - top) },
      });
      const origin = details.getBoundingClientRect();
      menu.style.left = `${layout.left - origin.left - details.clientLeft}px`;
      menu.style.top = `${layout.top - origin.top - details.clientTop}px`;
      menu.style.maxHeight = `${layout.maxHeight}px`;
      menu.dataset.positioned = "true";
    };
    const onScroll = (event: Event) => {
      if (event.target !== menu) update();
    };
    const observer = new ResizeObserver(update);
    observer.observe(details);
    observer.observe(menu);
    details.addEventListener("toggle", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      details.removeEventListener("toggle", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
    };
  });
}
