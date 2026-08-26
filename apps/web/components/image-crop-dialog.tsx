"use client";

import { RotateCcw, RotateCw, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  normalizeImageCrop,
  type ImageCropAspect,
  type NormalizedImageCrop,
} from "../lib/local-media-editor";
import { useI18n } from "./i18n-provider";

type Rotation = 0 | 90 | 180 | 270;
type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const fullCrop: NormalizedImageCrop = { x: 0, y: 0, width: 1, height: 1 };

const percent = (value: number) => Math.round(value * 100);

const presetCrop = (
  aspect: ImageCropAspect,
  width: number,
  height: number,
): NormalizedImageCrop => {
  if (aspect === "original") return fullCrop;
  const [left = 1, right = 1] = aspect.split(":").map(Number);
  const target = left / right;
  const current = width / height;
  if (current > target) {
    const cropWidth = target / current;
    return { x: (1 - cropWidth) / 2, y: 0, width: cropWidth, height: 1 };
  }
  const cropHeight = current / target;
  return { x: 0, y: (1 - cropHeight) / 2, width: 1, height: cropHeight };
};

export function ImageCropDialog({
  source,
  initialCrop,
  initialRotation,
  onCancel,
  onApply,
}: {
  source: Blob;
  initialCrop: NormalizedImageCrop;
  initialRotation: Rotation;
  onCancel: () => void;
  onApply: (value: { crop: NormalizedImageCrop; rotation: Rotation }) => void;
}) {
  const { text } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    crop: NormalizedImageCrop;
  } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState(() => normalizeImageCrop(initialCrop));
  const [rotation, setRotation] = useState<Rotation>(initialRotation);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(source);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const orientedDimensions = useMemo(
    () =>
      rotation === 90 || rotation === 270
        ? { width: dimensions.height, height: dimensions.width }
        : dimensions,
    [dimensions, rotation],
  );

  useEffect(() => {
    if (!sourceUrl) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const oriented =
        rotation === 90 || rotation === 270
          ? { width: image.naturalHeight, height: image.naturalWidth }
          : { width: image.naturalWidth, height: image.naturalHeight };
      const scale = Math.min(
        1,
        900 / Math.max(oriented.width, oriented.height),
      );
      canvas.width = Math.max(1, Math.round(oriented.width * scale));
      canvas.height = Math.max(1, Math.round(oriented.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(
        image,
        (-image.naturalWidth * scale) / 2,
        (-image.naturalHeight * scale) / 2,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      );
    };
    image.src = sourceUrl;
  }, [rotation, sourceUrl]);

  const updateCrop = (patch: Partial<NormalizedImageCrop>) =>
    setCrop((current) => normalizeImageCrop({ ...current, ...patch }));

  const rotate = (delta: -90 | 90) => {
    setRotation((current) => ((current + delta + 360) % 360) as Rotation);
    setCrop(fullCrop);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, mode: DragMode) => {
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId) return;
    const bounds = stage.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) / bounds.width;
    const dy = (event.clientY - drag.startY) / bounds.height;
    if (drag.mode === "move") {
      setCrop(
        normalizeImageCrop({
          ...drag.crop,
          x: drag.crop.x + dx,
          y: drag.crop.y + dy,
        }),
      );
      return;
    }
    const left = drag.mode.includes("w") ? drag.crop.x + dx : drag.crop.x;
    const top = drag.mode.includes("n") ? drag.crop.y + dy : drag.crop.y;
    const right = drag.mode.includes("e")
      ? drag.crop.x + drag.crop.width + dx
      : drag.crop.x + drag.crop.width;
    const bottom = drag.mode.includes("s")
      ? drag.crop.y + drag.crop.height + dy
      : drag.crop.y + drag.crop.height;
    setCrop(
      normalizeImageCrop({
        x: Math.min(left, right - 0.05),
        y: Math.min(top, bottom - 0.05),
        width: Math.max(0.05, right - left),
        height: Math.max(0.05, bottom - top),
      }),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <dialog
      ref={dialogRef}
      className="image-crop-dialog"
      aria-labelledby="image-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="image-crop-dialog-panel">
        <header>
          <div>
            <h2 id="image-crop-title">{text("mediaEditor.cropDialogTitle")}</h2>
            <p>{text("mediaEditor.cropInstructions")}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text("mediaEditor.cropCancel")}
            onClick={onCancel}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div
          ref={stageRef}
          className="image-crop-stage"
          style={{
            aspectRatio: `${orientedDimensions.width} / ${orientedDimensions.height}`,
            width: `min(100%, 720px, calc(52dvh * ${orientedDimensions.width / orientedDimensions.height}))`,
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" />
          <div
            className="image-crop-selection"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
            onPointerDown={(event) => beginDrag(event, "move")}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <span
                key={corner}
                className={`image-crop-handle ${corner}`}
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  beginDrag(event, corner);
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </div>
        </div>
        <div className="image-crop-toolbar">
          <label>
            <span>{text("mediaEditor.cropPreset")}</span>
            <select
              defaultValue="original"
              onChange={(event) =>
                setCrop(
                  presetCrop(
                    event.currentTarget.value as ImageCropAspect,
                    orientedDimensions.width,
                    orientedDimensions.height,
                  ),
                )
              }
            >
              <option value="original">
                {text("mediaEditor.cropOriginal")}
              </option>
              <option value="1:1">1:1</option>
              <option value="4:3">4:3</option>
              <option value="16:9">16:9</option>
            </select>
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={text("mediaEditor.rotateLeft")}
            onClick={() => rotate(-90)}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={text("mediaEditor.rotateRight")}
            onClick={() => rotate(90)}
          >
            <RotateCw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => {
              setRotation(0);
              setCrop(fullCrop);
            }}
          >
            {text("mediaEditor.cropReset")}
          </button>
        </div>
        <div className="image-crop-ranges">
          {(
            [
              ["x", "mediaEditor.cropHorizontal"],
              ["y", "mediaEditor.cropVertical"],
              ["width", "mediaEditor.cropWidth"],
              ["height", "mediaEditor.cropHeight"],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              <span>{text(label)}</span>
              <input
                type="range"
                min={field === "width" || field === "height" ? 5 : 0}
                max={
                  field === "x"
                    ? percent(1 - crop.width)
                    : field === "y"
                      ? percent(1 - crop.height)
                      : 100
                }
                value={percent(crop[field])}
                onChange={(event) =>
                  updateCrop({
                    [field]: Number(event.currentTarget.value) / 100,
                  })
                }
              />
              <output>{percent(crop[field])}%</output>
            </label>
          ))}
        </div>
        <footer>
          <button
            type="button"
            className="button button-quiet"
            onClick={onCancel}
          >
            {text("mediaEditor.cropCancel")}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onApply({ crop, rotation })}
          >
            {text("mediaEditor.cropApply")}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
