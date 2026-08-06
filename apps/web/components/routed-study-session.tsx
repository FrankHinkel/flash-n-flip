"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { StudySession } from "./study-session";
import {
  pendingOfflineStudyHrefKey,
  resolveHydratedStudyRouteSelection,
  resolveStudyRouteSelection,
  studySessionIdentity,
  type StudyRouteSelection,
} from "./study-navigation";

export function RoutedStudySession({
  initialDeckId = "",
  initialPracticeAll = false,
  initialDirection = "",
}: {
  initialDeckId?: string;
  initialPracticeAll?: boolean;
  initialDirection?: string;
}) {
  const searchParams = useSearchParams();
  const fallback = {
    deckId: initialDeckId,
    practiceAll: initialPracticeAll,
    direction: initialDirection,
  };
  const routerSelection = resolveStudyRouteSelection(searchParams, fallback);
  const [hydratedSelection, setHydratedSelection] =
    useState<StudyRouteSelection | null>(null);

  useEffect(() => {
    let pendingHref: string | null = null;
    try {
      pendingHref = window.sessionStorage.getItem(pendingOfflineStudyHrefKey);
      window.sessionStorage.removeItem(pendingOfflineStudyHrefKey);
    } catch {
      // The live address still carries the selected deck in normal browsers.
    }
    setHydratedSelection(
      resolveHydratedStudyRouteSelection(
        window.location.search,
        pendingHref,
        routerSelection,
      ),
    );
  }, [
    routerSelection.deckId,
    routerSelection.direction,
    routerSelection.practiceAll,
  ]);

  const selection = hydratedSelection ?? routerSelection;

  return (
    <StudySession
      key={studySessionIdentity(
        selection.deckId,
        selection.practiceAll,
        selection.direction,
      )}
      initialDeckId={selection.deckId}
      initialPracticeAll={selection.practiceAll}
      initialDirection={selection.direction}
    />
  );
}
