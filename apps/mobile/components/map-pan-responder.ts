import type { Dispatch, SetStateAction } from "react";
import { PanResponder } from "react-native";

type MapOffset = { x: number; y: number };

const touchDistance = (
  touches: readonly { pageX: number; pageY: number }[],
) => {
  if (touches.length < 2) return null;
  return Math.hypot(
    touches[0]!.pageX - touches[1]!.pageX,
    touches[0]!.pageY - touches[1]!.pageY,
  );
};

export function createMapPanResponder({
  offset,
  zoom,
  setOffset,
  setZoom,
}: {
  offset: MapOffset;
  zoom: number;
  setOffset: Dispatch<SetStateAction<MapOffset>>;
  setZoom: Dispatch<SetStateAction<number>>;
}) {
  let offsetAtDragStart = offset;
  let zoomAtGestureStart = zoom;
  let pinchDistanceAtStart: number | null = null;

  const changeZoom = (next: number) => {
    const clamped = Math.min(4, Math.max(1, next));
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  return PanResponder.create({
    onStartShouldSetPanResponder: (event) =>
      event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event, gesture) =>
      event.nativeEvent.touches.length >= 2 ||
      (zoom > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5),
    onPanResponderGrant: (event) => {
      offsetAtDragStart = offset;
      zoomAtGestureStart = zoom;
      pinchDistanceAtStart = touchDistance(event.nativeEvent.touches);
    },
    onPanResponderMove: (event, gesture) => {
      const distance = touchDistance(event.nativeEvent.touches);
      if (distance && pinchDistanceAtStart) {
        changeZoom(zoomAtGestureStart * (distance / pinchDistanceAtStart));
        return;
      }
      setOffset({
        x: offsetAtDragStart.x + gesture.dx / zoom,
        y: offsetAtDragStart.y + gesture.dy / zoom,
      });
    },
    onPanResponderRelease: () => {
      pinchDistanceAtStart = null;
    },
    onPanResponderTerminate: () => {
      pinchDistanceAtStart = null;
    },
  });
}
