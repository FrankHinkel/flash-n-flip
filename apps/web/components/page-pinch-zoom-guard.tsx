"use client";

import { useEffect } from "react";

import {
  getPagePinchZoomPreference,
  pagePinchZoomPreferenceChangedEvent,
  shouldPreventPagePinchZoom,
} from "../lib/page-pinch-zoom-preference";

const isInsideDedicatedZoomArea = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("[data-dedicated-zoom]"));

export function PagePinchZoomGuard() {
  useEffect(() => {
    let enabled = getPagePinchZoomPreference();
    const updatePreference = () => {
      enabled = getPagePinchZoomPreference();
    };
    const preventGesture = (event: Event) => {
      if (
        shouldPreventPagePinchZoom(
          enabled,
          isInsideDedicatedZoomArea(event.target),
        )
      ) {
        event.preventDefault();
      }
    };
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      preventGesture(event);
    };
    const preventTrackpadPinch = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      preventGesture(event);
    };

    window.addEventListener(
      pagePinchZoomPreferenceChangedEvent,
      updatePreference,
    );
    window.addEventListener("storage", updatePreference);
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });
    document.addEventListener("gestureend", preventGesture, {
      passive: false,
    });
    document.addEventListener("touchmove", preventMultiTouch, {
      passive: false,
    });
    document.addEventListener("wheel", preventTrackpadPinch, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener(
        pagePinchZoomPreferenceChangedEvent,
        updatePreference,
      );
      window.removeEventListener("storage", updatePreference);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("wheel", preventTrackpadPinch, true);
    };
  }, []);

  return null;
}
