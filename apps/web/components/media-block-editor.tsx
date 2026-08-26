"use client";

import {
  ArrowDown,
  ArrowUp,
  Camera,
  ImagePlus,
  Mic,
  Pencil,
  RefreshCw,
  Scissors,
  StopCircle,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createId } from "@flashcards/domain";
import type { CardContent, ContentBlock } from "@flashcards/domain/content";

import { getLocalProductOriginalMedia } from "../lib/local-product-repository";
import {
  decodeEditorMedia,
  LocalMediaValidationError,
  transformEditorImage,
  trimEditorAudioToWav,
  validateEditorMediaFile,
  type NormalizedImageCrop,
  type PendingEditorMedia,
} from "../lib/local-media-editor";
import { ImageCropDialog } from "./image-crop-dialog";
import { useI18n } from "./i18n-provider";

type EditableMediaBlock = Extract<ContentBlock, { type: "image" | "audio" }>;

const mediaBlocks = (content: CardContent): EditableMediaBlock[] =>
  content.blocks.filter(
    (block): block is EditableMediaBlock =>
      block.type === "image" || block.type === "audio",
  );

const replaceBlock = (
  content: CardContent,
  current: EditableMediaBlock,
  next: EditableMediaBlock | null,
): CardContent => ({
  blocks: content.blocks.flatMap((block) =>
    block === current ? (next ? [next] : []) : [block],
  ),
});

const insertMediaBlock = (
  content: CardContent,
  block: EditableMediaBlock,
): CardContent => {
  const markdownIndex = content.blocks.findIndex(
    (candidate) => candidate.type === "markdown",
  );
  const index = markdownIndex < 0 ? content.blocks.length : markdownIndex + 1;
  return {
    blocks: [
      ...content.blocks.slice(0, index),
      block,
      ...content.blocks.slice(index),
    ],
  };
};

const moveBlock = (
  content: CardContent,
  block: EditableMediaBlock,
  direction: -1 | 1,
): CardContent => {
  const editable = mediaBlocks(content);
  const current = editable.indexOf(block);
  const target = current + direction;
  if (current < 0 || target < 0 || target >= editable.length) return content;
  const other = editable[target];
  if (!other) return content;
  const left = content.blocks.indexOf(block);
  const right = content.blocks.indexOf(other);
  const blocks = [...content.blocks];
  blocks[left] = other;
  blocks[right] = block;
  return { blocks };
};

const errorKey = (cause: unknown) => {
  if (!(cause instanceof LocalMediaValidationError))
    return "mediaEditor.error.decode" as const;
  if (cause.code === "EMPTY") return "mediaEditor.error.empty" as const;
  if (cause.code === "TOO_LARGE") return "mediaEditor.error.tooLarge" as const;
  if (cause.code === "MIME_MISMATCH")
    return "mediaEditor.error.mimeMismatch" as const;
  if (cause.code === "UNSUPPORTED")
    return "mediaEditor.error.unsupported" as const;
  return "mediaEditor.error.decode" as const;
};

function EditorMediaPreview({
  mediaId,
  kind,
  pending,
  label,
  onAudioMetadata,
}: {
  mediaId: string;
  kind: "image" | "audio";
  pending?: PendingEditorMedia;
  label: string;
  onAudioMetadata?: (duration: number) => void;
}) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void (
      pending
        ? Promise.resolve(pending.blob)
        : getLocalProductOriginalMedia(mediaId)
    ).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, pending]);
  if (!source) return <span className="media-loading">…</span>;
  return kind === "image" ? (
    // This is a validated local blob URL and never an external resource.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="media-editor-preview-image" src={source} alt="" />
  ) : (
    <audio
      controls
      preload="metadata"
      src={source}
      aria-label={label}
      onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration)) onAudioMetadata?.(duration);
      }}
    />
  );
}

export function MediaBlockEditor({
  value,
  onChange,
  pendingMedia,
  onPendingMediaChange,
}: {
  value: CardContent;
  onChange: (value: CardContent) => void;
  pendingMedia: ReadonlyMap<string, PendingEditorMedia>;
  onPendingMediaChange: (
    media: ReadonlyMap<string, PendingEditorMedia>,
  ) => void;
}) {
  const { text } = useI18n();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cropByMedia, setCropByMedia] = useState<
    Record<string, NormalizedImageCrop>
  >({});
  const [rotationByMedia, setRotationByMedia] = useState<
    Record<string, 0 | 90 | 180 | 270>
  >({});
  const [durationByMedia, setDurationByMedia] = useState<
    Record<string, number>
  >({});
  const [trimByMedia, setTrimByMedia] = useState<
    Record<string, { start: number; end: number }>
  >({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const cropReturnFocusRef = useRef<HTMLElement | null>(null);
  const [cropSession, setCropSession] = useState<{
    block: Extract<EditableMediaBlock, { type: "image" }>;
    source: Blob;
  } | null>(null);

  const updatePending = (entry: PendingEditorMedia) => {
    const next = new Map(pendingMedia);
    next.set(entry.id, entry);
    onPendingMediaChange(next);
  };

  const addFile = async (
    file: File,
    kind: "image" | "audio",
    replacement?: EditableMediaBlock,
  ) => {
    setError("");
    setProcessing(true);
    try {
      const validated = await validateEditorMediaFile(file, kind);
      await decodeEditorMedia(validated);
      const id = createId();
      const blob =
        kind === "image" && validated.mimeType !== "image/gif"
          ? await transformEditorImage(validated.blob, {
              rotation: 0,
              crop: "original",
            })
          : validated.blob;
      updatePending({
        id,
        fileName:
          blob.type === "image/webp"
            ? `${validated.fileName.replace(/\.[^.]+$/, "")}.webp`
            : validated.fileName,
        mimeType: blob.type || validated.mimeType,
        blob,
        sourceBlob: validated.blob,
      });
      const block: EditableMediaBlock =
        kind === "image"
          ? {
              type: "image",
              mediaId: id,
              alt: replacement?.type === "image" ? replacement.alt : "",
              decorative:
                replacement?.type === "image" ? replacement.decorative : false,
            }
          : {
              type: "audio",
              mediaId: id,
              label:
                replacement?.type === "audio"
                  ? replacement.label
                  : validated.fileName,
              transcript:
                replacement?.type === "audio"
                  ? replacement.transcript
                  : undefined,
            };
      onChange(
        replacement
          ? replaceBlock(value, replacement, block)
          : insertMediaBlock(value, block),
      );
    } catch (cause) {
      setError(text(errorKey(cause)));
    } finally {
      setProcessing(false);
    }
  };

  const openImageCrop = async (
    block: Extract<EditableMediaBlock, { type: "image" }>,
  ) => {
    setError("");
    setProcessing(true);
    try {
      const pending = pendingMedia.get(block.mediaId);
      const source =
        pending?.sourceBlob ??
        (await getLocalProductOriginalMedia(block.mediaId));
      if (!source) throw new LocalMediaValidationError("DECODE_FAILED");
      cropReturnFocusRef.current = document.activeElement as HTMLElement;
      setCropSession({ block, source });
    } catch (cause) {
      setError(text(errorKey(cause)));
    } finally {
      setProcessing(false);
    }
  };

  const closeImageCrop = () => {
    setCropSession(null);
    requestAnimationFrame(() => cropReturnFocusRef.current?.focus());
  };

  const applyImageCrop = async (
    crop: NormalizedImageCrop,
    rotation: 0 | 90 | 180 | 270,
  ) => {
    if (!cropSession) return;
    const { block, source } = cropSession;
    setError("");
    setProcessing(true);
    try {
      const pending = pendingMedia.get(block.mediaId);
      const blob = await transformEditorImage(source, { rotation, crop });
      const id = pending ? block.mediaId : createId();
      updatePending({
        id,
        fileName: pending?.fileName ?? `image-${id}.webp`,
        mimeType: "image/webp",
        blob,
        sourceBlob: source,
      });
      setRotationByMedia((current) => ({
        ...current,
        [id]: rotation,
      }));
      setCropByMedia((current) => ({
        ...current,
        [id]: crop,
      }));
      if (id !== block.mediaId)
        onChange(replaceBlock(value, block, { ...block, mediaId: id }));
      closeImageCrop();
    } catch (cause) {
      setError(text(errorKey(cause)));
    } finally {
      setProcessing(false);
    }
  };

  const trimAudio = async (
    block: Extract<EditableMediaBlock, { type: "audio" }>,
  ) => {
    const duration = durationByMedia[block.mediaId] ?? 0;
    const trim = trimByMedia[block.mediaId] ?? { start: 0, end: duration };
    setError("");
    setProcessing(true);
    try {
      const pending = pendingMedia.get(block.mediaId);
      const source =
        pending?.sourceBlob ??
        (await getLocalProductOriginalMedia(block.mediaId));
      if (!source) throw new LocalMediaValidationError("DECODE_FAILED");
      const blob = await trimEditorAudioToWav(source, trim.start, trim.end);
      const id = pending ? block.mediaId : createId();
      updatePending({
        id,
        fileName: `${pending?.fileName ?? `audio-${id}`}.wav`,
        mimeType: "audio/wav",
        blob,
        sourceBlob: source,
      });
      if (id !== block.mediaId)
        onChange(replaceBlock(value, block, { ...block, mediaId: id }));
    } catch (cause) {
      setError(text(errorKey(cause)));
    } finally {
      setProcessing(false);
    }
  };

  const stopRecording = () => recorderRef.current?.stop();
  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : {},
      );
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recorderChunksRef.current, {
          type: recorder.mimeType || preferred || "audio/webm",
        });
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `recording.${extension}`, {
          type: blob.type,
        });
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        void addFile(file, "audio");
      };
      recorderRef.current = recorder;
      recorderStreamRef.current = stream;
      recorder.start(250);
      setRecording(true);
    } catch {
      setError(text("mediaEditor.error.microphone"));
    }
  };

  useEffect(
    () => () =>
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );

  const blocks = mediaBlocks(value);
  return (
    <section
      className="media-block-editor"
      aria-label={text("mediaEditor.title")}
    >
      <div className="media-editor-add-actions">
        <label
          className="button button-quiet"
          title={text("mediaEditor.addImage")}
        >
          <ImagePlus aria-hidden="true" size={17} />
          <span className="sr-only">{text("mediaEditor.addImage")}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            disabled={processing}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void addFile(file, "image");
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label
          className="button button-quiet"
          title={text("mediaEditor.camera")}
        >
          <Camera aria-hidden="true" size={17} />
          <span className="sr-only">{text("mediaEditor.camera")}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={processing}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void addFile(file, "image");
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label
          className="button button-quiet"
          title={text("mediaEditor.addAudio")}
        >
          <Volume2 aria-hidden="true" size={17} />
          <span className="sr-only">{text("mediaEditor.addAudio")}</span>
          <input
            type="file"
            accept="audio/aac,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"
            disabled={processing || recording}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void addFile(file, "audio");
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="button button-quiet"
          title={
            recording
              ? text("mediaEditor.stopRecording")
              : text("mediaEditor.record")
          }
          aria-label={
            recording
              ? text("mediaEditor.stopRecording")
              : text("mediaEditor.record")
          }
          aria-pressed={recording}
          disabled={processing}
          onClick={recording ? stopRecording : () => void startRecording()}
        >
          {recording ? (
            <StopCircle aria-hidden="true" size={17} />
          ) : (
            <Mic aria-hidden="true" size={17} />
          )}
        </button>
      </div>
      {processing ? (
        <p className="media-editor-status" role="status">
          <RefreshCw aria-hidden="true" className="spin" size={16} />
          {text("mediaEditor.processing")}
        </p>
      ) : null}
      {error ? (
        <p className="media-editor-error" role="alert">
          {error}
        </p>
      ) : null}
      {blocks.length ? (
        <ol className="media-editor-list">
          {blocks.map((block, index) => {
            const pending = pendingMedia.get(block.mediaId);
            return (
              <li key={`${block.type}:${block.mediaId}`}>
                <div className="media-editor-preview">
                  <EditorMediaPreview
                    mediaId={block.mediaId}
                    kind={block.type}
                    pending={pending}
                    label={block.type === "audio" ? block.label : block.alt}
                    onAudioMetadata={
                      block.type === "audio"
                        ? (duration) => {
                            setDurationByMedia((current) => ({
                              ...current,
                              [block.mediaId]: duration,
                            }));
                            setTrimByMedia((current) => ({
                              ...current,
                              [block.mediaId]: current[block.mediaId] ?? {
                                start: 0,
                                end: duration,
                              },
                            }));
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="media-editor-fields">
                  {block.type === "image" ? (
                    <>
                      <label>
                        <span>{text("mediaEditor.altText")}</span>
                        <input
                          value={block.alt}
                          disabled={block.decorative}
                          maxLength={500}
                          required={!block.decorative}
                          onChange={(event) =>
                            onChange(
                              replaceBlock(value, block, {
                                ...block,
                                alt: event.currentTarget.value,
                              }),
                            )
                          }
                        />
                        {!block.decorative && !block.alt.trim() ? (
                          <small
                            className="media-editor-field-error"
                            role="status"
                          >
                            {text("mediaEditor.altRequired")}
                          </small>
                        ) : null}
                      </label>
                      <label className="media-editor-check">
                        <input
                          type="checkbox"
                          checked={block.decorative}
                          onChange={(event) =>
                            onChange(
                              replaceBlock(value, block, {
                                ...block,
                                decorative: event.currentTarget.checked,
                                alt: event.currentTarget.checked
                                  ? ""
                                  : block.alt,
                              }),
                            )
                          }
                        />
                        <span>{text("mediaEditor.decorative")}</span>
                      </label>
                      <div className="media-editor-transform-actions">
                        <button
                          type="button"
                          className="button button-quiet"
                          disabled={processing}
                          onClick={() => void openImageCrop(block)}
                        >
                          <Pencil aria-hidden="true" size={16} />
                          {text("mediaEditor.editImage")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label>
                        <span>{text("mediaEditor.audioLabel")}</span>
                        <input
                          value={block.label}
                          maxLength={300}
                          required
                          onChange={(event) =>
                            onChange(
                              replaceBlock(value, block, {
                                ...block,
                                label: event.currentTarget.value,
                              }),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>{text("mediaEditor.transcript")}</span>
                        <textarea
                          rows={3}
                          maxLength={5_000}
                          value={block.transcript ?? ""}
                          onChange={(event) =>
                            onChange(
                              replaceBlock(value, block, {
                                ...block,
                                transcript:
                                  event.currentTarget.value || undefined,
                              }),
                            )
                          }
                        />
                      </label>
                      {durationByMedia[block.mediaId] ? (
                        <div className="media-editor-trim">
                          <label>
                            <span>{text("mediaEditor.trimStart")}</span>
                            <input
                              type="number"
                              min={0}
                              max={durationByMedia[block.mediaId]}
                              step={0.1}
                              value={trimByMedia[block.mediaId]?.start ?? 0}
                              onChange={(event) =>
                                setTrimByMedia((current) => ({
                                  ...current,
                                  [block.mediaId]: {
                                    start: Number(event.currentTarget.value),
                                    end:
                                      current[block.mediaId]?.end ??
                                      durationByMedia[block.mediaId] ??
                                      0,
                                  },
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>{text("mediaEditor.trimEnd")}</span>
                            <input
                              type="number"
                              min={0}
                              max={durationByMedia[block.mediaId]}
                              step={0.1}
                              value={
                                trimByMedia[block.mediaId]?.end ??
                                durationByMedia[block.mediaId]
                              }
                              onChange={(event) =>
                                setTrimByMedia((current) => ({
                                  ...current,
                                  [block.mediaId]: {
                                    start: current[block.mediaId]?.start ?? 0,
                                    end: Number(event.currentTarget.value),
                                  },
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="button button-quiet"
                            disabled={processing}
                            onClick={() => void trimAudio(block)}
                          >
                            <Scissors aria-hidden="true" size={16} />
                            {text("mediaEditor.trim")}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="media-editor-order-actions">
                  <label className="icon-button">
                    <RefreshCw aria-hidden="true" />
                    <span className="sr-only">
                      {text("mediaEditor.replace")}
                    </span>
                    <input
                      type="file"
                      accept={
                        block.type === "image"
                          ? "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                          : "audio/aac,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"
                      }
                      disabled={processing || recording}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void addFile(file, block.type, block);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={text("mediaEditor.moveUp")}
                    disabled={index === 0}
                    onClick={() => onChange(moveBlock(value, block, -1))}
                  >
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={text("mediaEditor.moveDown")}
                    disabled={index === blocks.length - 1}
                    onClick={() => onChange(moveBlock(value, block, 1))}
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={text("mediaEditor.remove")}
                    onClick={() => {
                      const nextPending = new Map(pendingMedia);
                      nextPending.delete(block.mediaId);
                      onPendingMediaChange(nextPending);
                      onChange(replaceBlock(value, block, null));
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {cropSession ? (
        <ImageCropDialog
          source={cropSession.source}
          initialCrop={
            cropByMedia[cropSession.block.mediaId] ?? {
              x: 0,
              y: 0,
              width: 1,
              height: 1,
            }
          }
          initialRotation={rotationByMedia[cropSession.block.mediaId] ?? 0}
          onCancel={closeImageCrop}
          onApply={({ crop, rotation }) => void applyImageCrop(crop, rotation)}
        />
      ) : null}
    </section>
  );
}

export const mediaAccessibilityValid = (content: CardContent): boolean =>
  content.blocks.every((block) => {
    if (block.type === "image")
      return block.decorative || Boolean(block.alt.trim());
    if (block.type === "audio") return Boolean(block.label.trim());
    return true;
  });
