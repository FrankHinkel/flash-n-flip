import type { CardContent } from "@flashcards/domain/content";

import { cardContentToSpeechText } from "./speech-text";

export function mapCardSpeechCue({
  locateTargetName,
  revealed,
  answer,
}: {
  locateTargetName?: string | null;
  revealed: boolean;
  answer?: CardContent | null;
}): string {
  if (revealed) {
    return answer ? cardContentToSpeechText(answer, true) : "";
  }
  return locateTargetName?.trim() ?? "";
}
