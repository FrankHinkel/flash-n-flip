"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { trustedIphoneWebstackReadyEvent } from "@flashcards/direct-connect-webstack/connection-state";

import {
  canSafelyReloadForPwaUpdate,
  isFlashNFlipServiceWorkerRegistration,
  isNativeCapacitorRuntime,
  pwaServiceWorkerPath,
  shouldReloadAfterPwaActivation,
} from "../lib/pwa-update";
import { useI18n } from "./i18n-provider";
import {
  pendingOfflineStudyHrefKey,
  studyHrefToPreserveAcrossOfflineReload,
} from "./study-navigation";

export type PwaUpdatePhase =
  "unavailable" | "current" | "checking" | "available" | "applying" | "error";

type PwaUpdateContextValue = {
  canApply: boolean;
  checkForUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  phase: PwaUpdatePhase;
  reloadRequired: boolean;
  supported: boolean;
  trustedIphoneVersion: string | null;
};

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);
const foregroundCheckIntervalMs = 5 * 60 * 1000;

const unavailableContext: PwaUpdateContextValue = {
  canApply: false,
  checkForUpdate: async () => {},
  applyUpdate: async () => {},
  phase: "unavailable",
  reloadRequired: false,
  supported: false,
  trustedIphoneVersion: null,
};

export const usePwaUpdate = (): PwaUpdateContextValue =>
  useContext(PwaUpdateContext) ?? unavailableContext;

export function PwaUpdateProvider({
  children,
  serverUpdates = true,
}: {
  children: React.ReactNode;
  serverUpdates?: boolean;
}) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheckRef = useRef(0);
  const applyingRef = useRef(false);
  const hadControllerRef = useRef(false);
  const activationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<PwaUpdatePhase>("unavailable");
  const [reloadRequired, setReloadRequired] = useState(false);
  const [trustedIphoneVersion, setTrustedIphoneVersion] = useState<
    string | null
  >(null);
  const trustedIphoneVersionRef = useRef<string | null>(null);

  pathnameRef.current = pathname;

  useEffect(() => {
    const onTrustedIphoneWebstackReady = (event: Event) => {
      const appVersion = (event as CustomEvent<{ appVersion?: unknown }>).detail
        ?.appVersion;
      if (typeof appVersion !== "string" || !appVersion.trim()) return;
      trustedIphoneVersionRef.current = appVersion;
      setTrustedIphoneVersion(appVersion);
      setSupported(true);
      setReloadRequired(true);
      setPhase("available");
    };
    window.addEventListener(
      trustedIphoneWebstackReadyEvent,
      onTrustedIphoneWebstackReady,
    );
    return () =>
      window.removeEventListener(
        trustedIphoneWebstackReadyEvent,
        onTrustedIphoneWebstackReady,
      );
  }, []);

  const syncRegistrationState = useCallback(
    (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setPhase("available");
        return;
      }
      if (!registration.installing) {
        setPhase((current) =>
          !trustedIphoneVersionRef.current &&
          (current === "checking" || current === "unavailable")
            ? "current"
            : current,
        );
      }
    },
    [],
  );

  const checkForUpdate = useCallback(async () => {
    const registration = registrationRef.current;
    if (!registration) return;

    setPhase("checking");
    try {
      lastCheckRef.current = Date.now();
      await registration.update();
      syncRegistrationState(registration);
    } catch {
      setPhase("error");
    }
  }, [syncRegistrationState]);

  const applyUpdate = useCallback(async () => {
    if (!canSafelyReloadForPwaUpdate(pathnameRef.current)) return;

    if (trustedIphoneVersionRef.current || reloadRequired) {
      window.location.reload();
      return;
    }

    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) {
      setPhase("error");
      return;
    }

    applyingRef.current = true;
    setPhase("applying");
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    activationTimeoutRef.current = setTimeout(() => {
      if (applyingRef.current) {
        applyingRef.current = false;
        setPhase("error");
      }
    }, 8000);
  }, [reloadRequired]);

  useEffect(() => {
    if (!serverUpdates) return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let disposed = false;
    const nativeRuntime = isNativeCapacitorRuntime(window);

    if (nativeRuntime) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) =>
                isFlashNFlipServiceWorkerRegistration(
                  registration.scope,
                  window.location.origin,
                ),
              )
              .map((registration) => registration.unregister()),
          ),
        )
        .catch(() => {
          // Native runtimes still remain excluded even if cleanup is unavailable.
        });
      return;
    }

    const useCachedDocumentNavigation = (event: MouseEvent) => {
      if (
        navigator.onLine ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname !== "/" &&
          !destination.pathname.startsWith("/app"))
      ) {
        return;
      }
      event.preventDefault();
      const pendingStudyHref = studyHrefToPreserveAcrossOfflineReload(
        destination,
        window.location.origin,
      );
      if (pendingStudyHref) {
        try {
          window.sessionStorage.setItem(
            pendingOfflineStudyHrefKey,
            pendingStudyHref,
          );
        } catch {
          // The real browser URL remains the primary fallback when storage is unavailable.
        }
      }
      window.location.assign(destination.href);
    };
    document.addEventListener("click", useCachedDocumentNavigation);

    setSupported(true);
    setPhase("checking");
    hadControllerRef.current = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (disposed) return;
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        setPhase("current");
        return;
      }
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
        activationTimeoutRef.current = null;
      }
      const updateRequestedInThisTab = applyingRef.current;
      applyingRef.current = false;
      setReloadRequired(true);
      if (
        shouldReloadAfterPwaActivation(
          updateRequestedInThisTab,
          pathnameRef.current,
        )
      ) {
        window.location.reload();
      } else {
        setPhase("available");
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const observeInstallingWorker = (
      worker: ServiceWorker,
      registration: ServiceWorkerRegistration,
    ) => {
      const onStateChange = () => {
        if (disposed) return;
        if (worker.state === "installed") {
          if (navigator.serviceWorker.controller) {
            setPhase("available");
          } else {
            setPhase("current");
          }
        } else if (worker.state === "redundant") {
          setPhase("error");
        } else if (worker.state === "activated") {
          syncRegistrationState(registration);
        }
      };
      worker.addEventListener("statechange", onStateChange);
    };

    let removeRegistrationListeners = () => {};
    void navigator.serviceWorker
      .register(pwaServiceWorkerPath, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        if (disposed) return;
        registrationRef.current = registration;
        lastCheckRef.current = Date.now();

        const onUpdateFound = () => {
          if (registration.installing) {
            observeInstallingWorker(registration.installing, registration);
          }
        };
        registration.addEventListener("updatefound", onUpdateFound);
        removeRegistrationListeners = () =>
          registration.removeEventListener("updatefound", onUpdateFound);

        if (registration.installing) {
          observeInstallingWorker(registration.installing, registration);
        }
        syncRegistrationState(registration);
        void registration
          .update()
          .then(() => syncRegistrationState(registration))
          .catch(() => {
            // Initial automatic download stays quiet while offline.
          });
      })
      .catch(() => {
        if (!disposed) setPhase("error");
      });

    const checkOnForeground = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastCheckRef.current < foregroundCheckIntervalMs
      ) {
        return;
      }
      const registration = registrationRef.current;
      if (!registration) return;
      lastCheckRef.current = Date.now();
      void registration
        .update()
        .then(() => syncRegistrationState(registration))
        .catch(() => {
          // An automatic foreground check stays quiet while offline.
        });
    };
    const foregroundCheckTimer = window.setInterval(
      checkOnForeground,
      foregroundCheckIntervalMs,
    );
    document.addEventListener("visibilitychange", checkOnForeground);
    window.addEventListener("online", checkOnForeground);
    window.addEventListener("focus", checkOnForeground);
    window.addEventListener("pageshow", checkOnForeground);

    return () => {
      disposed = true;
      registrationRef.current = null;
      removeRegistrationListeners();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", checkOnForeground);
      document.removeEventListener("click", useCachedDocumentNavigation);
      window.removeEventListener("online", checkOnForeground);
      window.removeEventListener("focus", checkOnForeground);
      window.removeEventListener("pageshow", checkOnForeground);
      window.clearInterval(foregroundCheckTimer);
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
      }
    };
  }, [serverUpdates, syncRegistrationState]);

  const contextValue = useMemo<PwaUpdateContextValue>(
    () => ({
      applyUpdate,
      canApply: canSafelyReloadForPwaUpdate(pathname),
      checkForUpdate,
      phase,
      reloadRequired,
      supported,
      trustedIphoneVersion,
    }),
    [
      applyUpdate,
      checkForUpdate,
      pathname,
      phase,
      reloadRequired,
      supported,
      trustedIphoneVersion,
    ],
  );

  return (
    <PwaUpdateContext.Provider value={contextValue}>
      {children}
    </PwaUpdateContext.Provider>
  );
}

export function PwaUpdateBanner() {
  const pathname = usePathname();
  const { text } = useI18n();
  const { applyUpdate, canApply, phase, reloadRequired, trustedIphoneVersion } =
    usePwaUpdate();

  if (
    phase !== "available" ||
    !canApply ||
    pathname === "/app/settings" ||
    (!pathname.startsWith("/app") && !pathname.startsWith("/community"))
  ) {
    return null;
  }

  return (
    <aside className="pwa-update-banner" role="status" aria-live="polite">
      <div>
        <strong>{text("legacy.5b0f7f181e33")}</strong>
        <span>
          {trustedIphoneVersion
            ? text("legacy.9be0a07e38ec", [trustedIphoneVersion])
            : reloadRequired
              ? text("legacy.d027e83a63bd")
              : text("legacy.60085c4dea9e")}
        </span>
      </div>
      <button className="button" onClick={() => void applyUpdate()}>
        {text("legacy.42e433696b8c")}
      </button>
    </aside>
  );
}
