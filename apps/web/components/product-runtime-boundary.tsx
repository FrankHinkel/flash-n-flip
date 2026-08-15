"use client";

import { usePathname } from "next/navigation";

import { requiresInstalledAppRuntime } from "../lib/installed-app-runtime";
import { PwaLaunchGate } from "./pwa-launch-gate";

export function ProductRuntimeBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return requiresInstalledAppRuntime(pathname) ? (
    <PwaLaunchGate>{children}</PwaLaunchGate>
  ) : (
    children
  );
}
