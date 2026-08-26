export const maximumEditorImageBytes = 15 * 1024 * 1024;
export const maximumEditorAudioBytes = 50 * 1024 * 1024;
export const maximumProcessedImageDimension = 2_048;

export type EditorMediaKind = "image" | "audio";

export type ValidatedEditorMedia = {
  kind: EditorMediaKind;
  mimeType: string;
  fileName: string;
  blob: Blob;
};

export type PendingEditorMedia = {
  id: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  sourceBlob: Blob;
};

export class LocalMediaValidationError extends Error {
  constructor(
    readonly code:
      "EMPTY" | "TOO_LARGE" | "UNSUPPORTED" | "MIME_MISMATCH" | "DECODE_FAILED",
  ) {
    super(code);
    this.name = "LocalMediaValidationError";
  }
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.slice(start, start + length));

export const detectEditorMediaMimeType = (input: Uint8Array): string | null => {
  const bytes = input.slice(0, 64);
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")
    return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return "image/webp";
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brand)) return "image/heic";
    if (/m4a|mp4|isom|iso2|mp41|mp42/.test(brand)) return "audio/mp4";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE")
    return "audio/wav";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "audio/webm";
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (
    bytes[0] === 0xff &&
    (((bytes[1] ?? 0) & 0xf6) === 0xf0 || ((bytes[1] ?? 0) & 0xf6) === 0xf2)
  )
    return "audio/aac";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
    return "audio/mpeg";
  return null;
};

const mimeFamily = (mimeType: string): string => mimeType.split("/")[0] ?? "";

const normalizedDeclaredMimeType = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/heif") return "image/heic";
  if (normalized === "audio/x-wav") return "audio/wav";
  if (normalized === "audio/m4a" || normalized === "audio/x-m4a")
    return "audio/mp4";
  return normalized;
};

const safeFileName = (name: string, mimeType: string): string => {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
    .trim()
    .replace(/^[.-]+/, "")
    .slice(0, 180);
  if (cleaned) return cleaned;
  return mimeType.startsWith("image/") ? "image" : "audio";
};

export async function validateEditorMediaFile(
  file: Blob & { name?: string },
  expectedKind: EditorMediaKind,
): Promise<ValidatedEditorMedia> {
  if (!file.size) throw new LocalMediaValidationError("EMPTY");
  const maximum =
    expectedKind === "image"
      ? maximumEditorImageBytes
      : maximumEditorAudioBytes;
  if (file.size > maximum) throw new LocalMediaValidationError("TOO_LARGE");
  const detected = detectEditorMediaMimeType(
    new Uint8Array(await file.slice(0, 64).arrayBuffer()),
  );
  if (!detected || mimeFamily(detected) !== expectedKind)
    throw new LocalMediaValidationError("UNSUPPORTED");
  if (file.type) {
    const declared = normalizedDeclaredMimeType(file.type);
    if (mimeFamily(declared) !== expectedKind || declared !== detected)
      throw new LocalMediaValidationError("MIME_MISMATCH");
  }
  return {
    kind: expectedKind,
    mimeType: detected,
    fileName: safeFileName(file.name ?? "", detected),
    blob: new Blob([await file.arrayBuffer()], { type: detected }),
  };
}

const loadImage = async (
  blob: Blob,
): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const source = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    await image.decode();
    return image;
  } catch {
    throw new LocalMediaValidationError("DECODE_FAILED");
  } finally {
    URL.revokeObjectURL(source);
  }
};

export async function decodeEditorMedia(
  media: ValidatedEditorMedia,
): Promise<void> {
  if (media.kind === "image") {
    const image = await loadImage(media.blob);
    if (!(image.width > 0 && image.height > 0))
      throw new LocalMediaValidationError("DECODE_FAILED");
    if ("close" in image) image.close();
    return;
  }
  const source = URL.createObjectURL(media.blob);
  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () =>
        Number.isFinite(audio.duration) && audio.duration > 0
          ? resolve()
          : reject(new LocalMediaValidationError("DECODE_FAILED"));
      audio.onerror = () =>
        reject(new LocalMediaValidationError("DECODE_FAILED"));
      audio.src = source;
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

export type ImageCropAspect = "original" | "1:1" | "4:3" | "16:9";

export type NormalizedImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageCrop = ImageCropAspect | NormalizedImageCrop;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const normalizeImageCrop = (
  crop: NormalizedImageCrop,
): NormalizedImageCrop => {
  const width = clamp(crop.width, 0.05, 1);
  const height = clamp(crop.height, 0.05, 1);
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
};

export const orientedImageDimensions = (
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
): { width: number; height: number } =>
  rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };

const cropDimensions = (
  width: number,
  height: number,
  aspect: ImageCropAspect,
): NormalizedImageCrop => {
  if (aspect === "original") return { x: 0, y: 0, width: 1, height: 1 };
  const [left = 1, right = 1] = aspect.split(":").map(Number);
  const target = left / right;
  const current = width / height;
  if (current > target) {
    const nextWidth = target / current;
    return { x: (1 - nextWidth) / 2, y: 0, width: nextWidth, height: 1 };
  }
  const nextHeight = current / target;
  return { x: 0, y: (1 - nextHeight) / 2, width: 1, height: nextHeight };
};

export const resolveImageCrop = (
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  crop: ImageCrop,
): NormalizedImageCrop => {
  const oriented = orientedImageDimensions(width, height, rotation);
  return normalizeImageCrop(
    typeof crop === "string"
      ? cropDimensions(oriented.width, oriented.height, crop)
      : crop,
  );
};

export const imageCropSourceRect = (
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  crop: ImageCrop,
) => {
  const oriented = orientedImageDimensions(width, height, rotation);
  const normalized = resolveImageCrop(width, height, rotation, crop);
  const x = normalized.x * oriented.width;
  const y = normalized.y * oriented.height;
  const cropWidth = normalized.width * oriented.width;
  const cropHeight = normalized.height * oriented.height;
  if (rotation === 90)
    return {
      x: y,
      y: height - x - cropWidth,
      width: cropHeight,
      height: cropWidth,
      outputWidth: cropWidth,
      outputHeight: cropHeight,
    };
  if (rotation === 180)
    return {
      x: width - x - cropWidth,
      y: height - y - cropHeight,
      width: cropWidth,
      height: cropHeight,
      outputWidth: cropWidth,
      outputHeight: cropHeight,
    };
  if (rotation === 270)
    return {
      x: width - y - cropHeight,
      y: x,
      width: cropHeight,
      height: cropWidth,
      outputWidth: cropWidth,
      outputHeight: cropHeight,
    };
  return {
    x,
    y,
    width: cropWidth,
    height: cropHeight,
    outputWidth: cropWidth,
    outputHeight: cropHeight,
  };
};

export async function transformEditorImage(
  source: Blob,
  options: { rotation: 0 | 90 | 180 | 270; crop: ImageCrop },
): Promise<Blob> {
  const image = await loadImage(source);
  try {
    const crop = imageCropSourceRect(
      image.width,
      image.height,
      options.rotation,
      options.crop,
    );
    const scale = Math.min(
      1,
      maximumProcessedImageDimension /
        Math.max(crop.outputWidth, crop.outputHeight),
    );
    const outputWidth = Math.max(1, Math.round(crop.outputWidth * scale));
    const outputHeight = Math.max(1, Math.round(crop.outputHeight * scale));
    const sourceWidth = Math.max(1, Math.round(crop.width * scale));
    const sourceHeight = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new LocalMediaValidationError("DECODE_FAILED");
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((options.rotation * Math.PI) / 180);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -sourceWidth / 2,
      -sourceHeight / 2,
      sourceWidth,
      sourceHeight,
    );
    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    if (!result) throw new LocalMediaValidationError("DECODE_FAILED");
    return result;
  } finally {
    if ("close" in image) image.close();
  }
}

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1)
    view.setUint8(offset + index, value.charCodeAt(index));
};

export async function trimEditorAudioToWav(
  source: Blob,
  startSeconds: number,
  endSeconds: number,
): Promise<Blob> {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    const start = Math.max(0, Math.floor(startSeconds * decoded.sampleRate));
    const end = Math.min(
      decoded.length,
      Math.ceil(endSeconds * decoded.sampleRate),
    );
    if (end <= start) throw new LocalMediaValidationError("DECODE_FAILED");
    const frames = end - start;
    const channels = decoded.numberOfChannels;
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, bytes.byteLength - 8, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, decoded.sampleRate, true);
    view.setUint32(28, decoded.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, frames * channels * 2, true);
    let offset = 44;
    const channelData = Array.from({ length: channels }, (_, channel) =>
      decoded.getChannelData(channel),
    );
    for (let frame = start; frame < end; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(
          -1,
          Math.min(1, channelData[channel]?.[frame] ?? 0),
        );
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true,
        );
        offset += 2;
      }
    }
    return new Blob([bytes], { type: "audio/wav" });
  } catch (cause) {
    if (cause instanceof LocalMediaValidationError) throw cause;
    throw new LocalMediaValidationError("DECODE_FAILED");
  } finally {
    await context.close();
  }
}
