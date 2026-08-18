"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { StudyBadgePlan } from "@flashcards/domain";

import {
  localStudyBadgePlan,
  studyBadgeInvalidatedEvent,
} from "./local-product-repository";

export type StudyBadgePermissionStatus =
  "notDetermined" | "denied" | "authorized" | "provisional" | "ephemeral";

type StudyBadgePermissionResult = {
  status: StudyBadgePermissionStatus;
};

interface FlashNFlipStudyBadgePlugin {
  getPermissionStatus(): Promise<StudyBadgePermissionResult>;
  requestPermission(): Promise<StudyBadgePermissionResult>;
  replacePlan(plan: StudyBadgePlan): Promise<void>;
}

export const flashNFlipStudyBadge = registerPlugin<FlashNFlipStudyBadgePlugin>(
  "FlashNFlipStudyBadge",
);

export const nativeStudyBadgeIsAvailable = (): boolean =>
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === "ios" &&
  Capacitor.isPluginAvailable("FlashNFlipStudyBadge");

export const studyBadgePermissionIsGranted = (
  status: StudyBadgePermissionStatus,
): boolean =>
  status === "authorized" || status === "provisional" || status === "ephemeral";

export async function getNativeStudyBadgePermission(): Promise<
  StudyBadgePermissionStatus | "unavailable"
> {
  if (!nativeStudyBadgeIsAvailable()) return "unavailable";
  return (await flashNFlipStudyBadge.getPermissionStatus()).status;
}

export type NativeStudyBadgeRefreshResult = {
  status: StudyBadgePermissionStatus | "unavailable";
  plan: StudyBadgePlan | null;
  error: string | null;
};

export async function refreshNativeStudyBadge(options?: {
  requestPermission?: boolean;
}): Promise<NativeStudyBadgeRefreshResult> {
  if (!nativeStudyBadgeIsAvailable()) {
    return { status: "unavailable", plan: null, error: null };
  }
  let status: StudyBadgePermissionStatus | "unavailable" = "unavailable";
  try {
    const permission = options?.requestPermission
      ? await flashNFlipStudyBadge.requestPermission()
      : await flashNFlipStudyBadge.getPermissionStatus();
    status = permission.status;
    if (!studyBadgePermissionIsGranted(permission.status)) {
      return { status: permission.status, plan: null, error: null };
    }
    const plan = await localStudyBadgePlan();
    await flashNFlipStudyBadge.replacePlan(plan);
    return { status: permission.status, plan, error: null };
  } catch (cause) {
    return {
      status,
      plan: null,
      error:
        cause instanceof Error
          ? cause.message
          : "Das App-Icon-Badge konnte nicht aktualisiert werden.",
    };
  }
}

let lifecycleInstalled = false;
let refreshQueued = false;
let refreshInFlight: Promise<void> = Promise.resolve();

const queueStudyBadgeRefresh = (): void => {
  if (refreshQueued || !nativeStudyBadgeIsAvailable()) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refreshInFlight = refreshInFlight.then(async () => {
      await refreshNativeStudyBadge();
    });
  });
};

export const installNativeStudyBadgeLifecycle = (): void => {
  if (lifecycleInstalled || !nativeStudyBadgeIsAvailable()) return;
  lifecycleInstalled = true;
  window.addEventListener("flash-n-flip:decks-changed", queueStudyBadgeRefresh);
  window.addEventListener(studyBadgeInvalidatedEvent, queueStudyBadgeRefresh);
  window.addEventListener("pageshow", queueStudyBadgeRefresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") queueStudyBadgeRefresh();
  });
  queueStudyBadgeRefresh();
};
