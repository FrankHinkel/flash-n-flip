"use client";

import type { AccountShareQrPayload } from "@flashcards/domain";
import jsQR from "jsqr";
import { Clipboard, ScanQrCode, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";

import { decodeFlashNFlipQrAction } from "../lib/qr-action";
import { AccountShareDialog } from "./account-share-dialog";
import { useI18n } from "./i18n-provider";

const SCAN_INTERVAL_MS = 120;
const MAX_SCAN_WIDTH = 720;
const qrScannerOpenEvent = "flash-n-flip:qr-scanner-open";

export function QrScannerProvider() {
  const { text } = useI18n();
  const [open, setOpen] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [information, setInformation] = useState("");
  const [shareInvitation, setShareInvitation] =
    useState<AccountShareQrPayload | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef(0);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraRequested(false);
  }, []);

  const clearHash = useCallback(() => {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  const handleValue = useCallback(
    (value: string) => {
      try {
        const action = decodeFlashNFlipQrAction(value, window.location.origin);
        stopCamera();
        setError("");
        clearHash();
        if (action.kind === "ACCOUNT_SHARE") {
          setOpen(false);
          setShareInvitation(action.invitation);
          return;
        }
        setInformation(text("legacy.10288bced57a"));
        setOpen(true);
      } catch {
        setInformation("");
        setError(text("legacy.3d5ea7f1bee4"));
        setOpen(true);
      }
    },
    [clearHash, stopCamera, text],
  );

  const startCamera = useCallback(async () => {
    setError("");
    setInformation("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraRequested(false);
      setError(text("legacy.e2fcc5f30584"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      lastScanRef.current = 0;

      const scanFrame = (now: number) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || streamRef.current !== stream) return;
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          now - lastScanRef.current >= SCAN_INTERVAL_MS
        ) {
          lastScanRef.current = now;
          const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth);
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const context = canvas.getContext("2d", {
            willReadFrequently: true,
          });
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const result = jsQR(pixels.data, pixels.width, pixels.height, {
              inversionAttempts: "attemptBoth",
            });
            if (result?.data) {
              stopCamera();
              handleValue(result.data);
              return;
            }
          }
        }
        frameRef.current = window.requestAnimationFrame(scanFrame);
      };
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch {
      stopCamera();
      setError(text("legacy.0f17d200f33d"));
    }
  }, [handleValue, stopCamera, text]);

  const openScanner = useCallback((trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setOpen(true);
    setCameraRequested(true);
    setError("");
    setInformation("");
    setLink("");
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [stopCamera]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: HTMLButtonElement }>)
        .detail?.trigger;
      if (trigger) openScanner(trigger);
    };
    window.addEventListener(qrScannerOpenEvent, handleOpen);
    return () => window.removeEventListener(qrScannerOpenEvent, handleOpen);
  }, [openScanner]);

  useEffect(() => {
    if (open && cameraRequested && !streamRef.current) void startCamera();
  }, [cameraRequested, open, startCamera]);

  useEffect(() => {
    const handleHash = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (!fragment.has("share") && !fragment.has("pair")) return;
      handleValue(window.location.href);
      clearHash();
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [clearHash, handleValue]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeScanner();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),a[href]",
        ) ?? []),
      ];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [closeScanner, open]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const submitLink = (event: FormEvent) => {
    event.preventDefault();
    handleValue(link);
  };

  const pasteLink = async () => {
    try {
      const value = await navigator.clipboard.readText();
      setLink(value);
      handleValue(value);
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {open ? (
        <div
          className="qr-scanner-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeScanner()
          }
        >
          <section
            ref={dialogRef}
            className="qr-scanner-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
          >
            <header>
              <ScanQrCode aria-hidden="true" />
              <h2 id="qr-scanner-title">{text("legacy.28ce52b9fefd")}</h2>
              <button
                ref={closeRef}
                className="icon-button"
                type="button"
                aria-label={text("legacy.8901917b6cd6")}
                onClick={closeScanner}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="qr-camera-frame">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label={text("legacy.3e6c15531350")}
              />
              {!cameraActive ? (
                <button
                  className="button button-quiet"
                  type="button"
                  disabled={cameraRequested}
                  onClick={() => setCameraRequested(true)}
                >
                  <ScanQrCode aria-hidden="true" size={18} />
                  {text("legacy.5a2e26fc2f3f")}
                </button>
              ) : null}
            </div>
            <canvas ref={canvasRef} hidden aria-hidden="true" />
            <form className="qr-link-form" onSubmit={submitLink}>
              <label className="sr-only" htmlFor="qr-invitation-link">
                {text("legacy.4699cb5600dc")}
              </label>
              <input
                ref={inputRef}
                id="qr-invitation-link"
                value={link}
                maxLength={8_192}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder={text("legacy.1a0aa81133a3")}
                onFocus={stopCamera}
                onChange={(event) => setLink(event.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={text("legacy.1a0aa81133a3")}
                onClick={() => void pasteLink()}
              >
                <Clipboard aria-hidden="true" size={20} />
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={!link.trim()}
              >
                {text("legacy.2ffc109d7f67")}
              </button>
            </form>
            {information ? (
              <p className="qr-scanner-information" role="status">
                {information}
              </p>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
      {shareInvitation ? (
        <AccountShareDialog
          invitation={shareInvitation}
          onClose={() => {
            setShareInvitation(null);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}

type QrScannerButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type"
> & {
  children?: ReactNode;
  iconSize?: number;
};

export function QrScannerButton({
  children,
  iconSize = 20,
  ...props
}: QrScannerButtonProps) {
  const { text } = useI18n();

  return (
    <button
      {...props}
      type="button"
      aria-label={
        props["aria-label"] ??
        (children ? undefined : text("legacy.28ce52b9fefd"))
      }
      onClick={(event) =>
        window.dispatchEvent(
          new CustomEvent(qrScannerOpenEvent, {
            detail: { trigger: event.currentTarget },
          }),
        )
      }
    >
      <ScanQrCode aria-hidden="true" size={iconSize} />
      {children}
    </button>
  );
}
