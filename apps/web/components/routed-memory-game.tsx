"use client";

import { useSearchParams } from "next/navigation";

import { MemoryGame } from "./memory-game";
import { resolveMemoryRouteSelection } from "./study-memory-route";

export function RoutedMemoryGame() {
  const selection = resolveMemoryRouteSelection(useSearchParams());
  return (
    <MemoryGame
      deckId={selection.deckId}
      ratings={selection.ratings}
      initialPairCount={selection.pairCount}
    />
  );
}
