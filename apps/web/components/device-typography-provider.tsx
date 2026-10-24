"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { devicePreferencesStorage } from "@flashcards/direct-connect-webstack/device-preferences-storage";
import {
  parseTextSize,
  textSizeFactors,
  textSizePreferenceKey,
  typographyChangedEvent,
  typographyProfile,
  type TextSizeLevel,
} from "../lib/device-typography";

type TypographyState = {
  level: TextSizeLevel;
  busy: boolean;
  error: boolean;
  save: (level: TextSizeLevel) => Promise<void>;
};
const Context = createContext<TypographyState | null>(null);
const nativeTypography = registerPlugin<{
  apply(options: { captionSize: number }): Promise<void>;
}>("FlashNFlipTypography");

function apply(level: TextSizeLevel) {
  const root = document.documentElement;
  root.dataset.typographyProfile = typographyProfile(
    root.dataset.nativeTypographyProfile,
    navigator.userAgent,
    navigator.maxTouchPoints,
  );
  root.style.setProperty(
    "--device-font-factor",
    String(textSizeFactors[level]),
  );
  root.dataset.textSize = level;
  window.dispatchEvent(new Event(typographyChangedEvent));
  if (Capacitor.isPluginAvailable("FlashNFlipTypography")) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;font-size:var(--text-caption)";
    root.append(probe);
    const captionSize = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    void nativeTypography.apply({ captionSize }).catch(() => undefined);
  }
}

export function DeviceTypographyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [level, setLevel] = useState<TextSizeLevel>("normal");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    let cached: TextSizeLevel = "normal";
    try {
      cached = parseTextSize(
        window.localStorage.getItem(textSizePreferenceKey),
      );
    } catch {
      /* Cache is optional. */
    }
    apply(cached);
    setLevel(cached);
    const load = async () => {
      const requestVersion = ++version.current;
      try {
        const stored = parseTextSize(
          await devicePreferencesStorage().get(textSizePreferenceKey),
        );
        if (!mounted.current || requestVersion !== version.current) return;
        apply(stored);
        setLevel(stored);
        try {
          window.localStorage.setItem(textSizePreferenceKey, stored);
        } catch {
          /* Durable store remains authoritative. */
        }
        setError(false);
      } catch {
        if (mounted.current) setError(true);
      } finally {
        if (mounted.current && requestVersion === version.current)
          setBusy(false);
      }
    };
    void load();
    const systemChanged = () =>
      apply(parseTextSize(document.documentElement.dataset.textSize));
    const storageChanged = (event: StorageEvent) => {
      if (event.key === textSizePreferenceKey) void load();
    };
    window.addEventListener("flash-n-flip:system-typography", systemChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      mounted.current = false;
      version.current++;
      window.removeEventListener(
        "flash-n-flip:system-typography",
        systemChanged,
      );
      window.removeEventListener("storage", storageChanged);
      delete document.documentElement.dataset.typographyProfile;
      document.documentElement.style.removeProperty("--device-font-factor");
    };
  }, []);

  async function save(next: TextSizeLevel) {
    if (busy) return;
    const requestVersion = ++version.current;
    setBusy(true);
    setError(false);
    try {
      await devicePreferencesStorage().set(textSizePreferenceKey, next);
      if (!mounted.current || requestVersion !== version.current) return;
      apply(next);
      setLevel(next);
      try {
        window.localStorage.setItem(textSizePreferenceKey, next);
      } catch {
        /* Cache is optional. */
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Context.Provider value={{ level, busy, error, save }}>
      {children}
    </Context.Provider>
  );
}

export const useDeviceTypography = () => useContext(Context);
