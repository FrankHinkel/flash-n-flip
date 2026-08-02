"use client";

import { useSearchParams } from "next/navigation";

import { StudySession } from "./study-session";
import {
  resolveStudyRouteSelection,
  studySessionIdentity,
} from "./study-navigation";

export function RoutedStudySession({
  initialDeckId = "",
  initialPracticeAll = false,
}: {
  initialDeckId?: string;
  initialPracticeAll?: boolean;
}) {
  const searchParams = useSearchParams();
  const selection = resolveStudyRouteSelection(searchParams, {
    deckId: initialDeckId,
    practiceAll: initialPracticeAll,
  });

  return (
    <StudySession
      key={studySessionIdentity(selection.deckId, selection.practiceAll)}
      initialDeckId={selection.deckId}
      initialPracticeAll={selection.practiceAll}
    />
  );
}
