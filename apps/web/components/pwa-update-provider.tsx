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

import {
  canSafelyReloadForPwaUpdate,
  isFlashNFlipServiceWorkerRegistration,
  isNativeCapacitorRuntime,
  pwaServiceWorkerPath,
  shouldReloadAfterPwaActivation,
} from "../lib/pwa-update";
import { useI18n } from "./i18n-provider";

export type PwaUpdatePhase =
  "unavailable" | "current" | "checking" | "available" | "applying" | "error";

type PwaUpdateContextValue = {
  canApply: boolean;
  checkForUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  phase: PwaUpdatePhase;
  reloadRequired: boolean;
  supported: boolean;
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
};

export const usePwaUpdate = (): PwaUpdateContextValue =>
  useContext(PwaUpdateContext) ?? unavailableContext;

export function PwaUpdateProvider({ children }: { children: React.ReactNode }) {
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

  pathnameRef.current = pathname;

  const syncRegistrationState = useCallback(
    (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setPhase("available");
        return;
      }
      if (!registration.installing) {
        setPhase((current) =>
          current === "checking" || current === "unavailable"
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

    if (reloadRequired) {
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
    document.addEventListener("visibilitychange", checkOnForeground);
    window.addEventListener("online", checkOnForeground);

    return () => {
      disposed = true;
      registrationRef.current = null;
      removeRegistrationListeners();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", checkOnForeground);
      window.removeEventListener("online", checkOnForeground);
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
      }
    };
  }, [syncRegistrationState]);

  const contextValue = useMemo<PwaUpdateContextValue>(
    () => ({
      applyUpdate,
      canApply: canSafelyReloadForPwaUpdate(pathname),
      checkForUpdate,
      phase,
      reloadRequired,
      supported,
    }),
    [applyUpdate, checkForUpdate, pathname, phase, reloadRequired, supported],
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
  const { applyUpdate, canApply, phase, reloadRequired } = usePwaUpdate();

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
        <strong>{text("Update available", "Aktualisierung verfügbar")}</strong>
        <span>
          {reloadRequired
            ? text(
                "The new version is ready. Reload when it suits you.",
                "Die neue Version ist bereit. Lade neu, wenn es für dich passt.",
              )
            : text(
                "Install the new Web app version when you are ready.",
                "Installiere die neue Web-App-Version, wenn du bereit bist.",
              )}
        </span>
      </div>
      <button className="button" onClick={() => void applyUpdate()}>
        {text("Update now", "Jetzt aktualisieren")}
      </button>
    </aside>
  );
}
