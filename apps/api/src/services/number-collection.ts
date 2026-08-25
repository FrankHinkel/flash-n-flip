import type {
  NumberLocale,
  NumberPracticeMaximum,
} from "@flashcards/domain/numbers";
import {
  createNumberCollectionDeckSeeds,
  numberCollectionCategoryFromTags,
  numberCollectionPairKey,
  numberCollectionSequenceFromTags,
  numberCollectionTag,
  numberCollectionTemplate,
  numberCollectionTemplateKey,
  numberExerciseTag,
  numberProgressUnitTag as progressUnitTag,
  renderNumberExerciseCard,
  type NumberCollectionUiLocale,
} from "@flashcards/domain/number-collection";

import type { db as database } from "../db/client.js";
import { syncVirtualCollectionForOwner } from "./virtual-collection-sync.js";

export {
  createNumberCollectionDeckSeeds,
  numberCollectionCategoryFromTags,
  numberCollectionSequenceFromTags,
  numberCollectionTag,
  numberCollectionTemplate,
  numberCollectionTemplateKey,
  numberExerciseTag,
  progressUnitTag,
  renderNumberExerciseCard,
};

export async function syncNumberCollectionForOwner(
  db: typeof database,
  ownerId: string,
  input: {
    sourceLocale: NumberLocale;
    targetLocale: NumberLocale;
    maximum: NumberPracticeMaximum;
    uiLocale: NumberCollectionUiLocale;
  },
) {
  const seeds = await createNumberCollectionDeckSeeds(input);
  const result = await syncVirtualCollectionForOwner(db, ownerId, seeds);
  return {
    ...result,
    rootDeckId: result.idsByKey.get(numberCollectionTemplateKey)!,
    pairDeckId: result.idsByKey.get(
      numberCollectionPairKey(input.sourceLocale, input.targetLocale),
    )!,
  };
}
