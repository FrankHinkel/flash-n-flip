"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

export type LocalFileExportResult = "CANCELLED" | "DOWNLOADED" | "SHARED";
export type LocalFileExportErrorCode =
  "NATIVE_SHARE_UNAVAILABLE" | "FILE_SHARE_UNSUPPORTED";

export class LocalFileExportError extends Error {
  constructor(readonly code: LocalFileExportErrorCode) {
    super(code);
    this.name = "LocalFileExportError";
  }
}

type NativeExportSession = { exportId: string };
type NativeExportCompletion = { completed: boolean };

interface FlashNFlipFileExportPlugin {
  beginExport(options: {
    fileName: string;
    mimeType: string;
    byteSize: number;
  }): Promise<NativeExportSession>;
  appendChunk(options: { exportId: string; dataBase64: string }): Promise<void>;
  shareExport(options: { exportId: string }): Promise<NativeExportCompletion>;
  discardExport(options: { exportId: string }): Promise<void>;
}

const nativeFileExport = registerPlugin<FlashNFlipFileExportPlugin>(
  "FlashNFlipFileExport",
);

const browserDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const nativeShare = async (
  blob: Blob,
  fileName: string,
): Promise<LocalFileExportResult> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { exportId } = await nativeFileExport.beginExport({
    fileName,
    mimeType: blob.type || "application/octet-stream",
    byteSize: bytes.byteLength,
  });
  try {
    const chunkBytes = 256 * 1024;
    for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes) {
      await nativeFileExport.appendChunk({
        exportId,
        dataBase64: bytesToBase64(bytes.subarray(offset, offset + chunkBytes)),
      });
    }
    const result = await nativeFileExport.shareExport({ exportId });
    return result.completed ? "SHARED" : "CANCELLED";
  } catch (cause) {
    await nativeFileExport.discardExport({ exportId }).catch(() => undefined);
    throw cause;
  }
};

const webShareFallback = async (
  blob: Blob,
  fileName: string,
): Promise<LocalFileExportResult> => {
  if (typeof navigator.share !== "function") {
    throw new LocalFileExportError("NATIVE_SHARE_UNAVAILABLE");
  }
  const file = new File([blob], fileName, {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
  const shareData: ShareData = { files: [file], title: fileName };
  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare(shareData)
  ) {
    throw new LocalFileExportError("FILE_SHARE_UNSUPPORTED");
  }
  try {
    await navigator.share(shareData);
    return "SHARED";
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return "CANCELLED";
    }
    throw cause;
  }
};

export async function exportLocalFile(
  blob: Blob,
  fileName: string,
): Promise<LocalFileExportResult> {
  if (!Capacitor.isNativePlatform()) {
    browserDownload(blob, fileName);
    return "DOWNLOADED";
  }
  return Capacitor.isPluginAvailable("FlashNFlipFileExport")
    ? nativeShare(blob, fileName)
    : webShareFallback(blob, fileName);
}
