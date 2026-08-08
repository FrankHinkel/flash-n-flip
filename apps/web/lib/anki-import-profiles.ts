import { openDB } from "idb";

import {
  ankiImportProfileSchema,
  type AnkiImportProfile,
} from "@flashcards/domain/anki-import-profile";

const database = () =>
  openDB("flash-n-flip-anki-import-profiles-v1", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }
    },
  });

export async function storedAnkiImportProfiles(): Promise<AnkiImportProfile[]> {
  const values = await (await database()).getAll("profiles");
  return values
    .flatMap((value) => {
      const parsed = ankiImportProfileSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveAnkiImportProfile(
  candidate: AnkiImportProfile,
): Promise<AnkiImportProfile> {
  const profile = ankiImportProfileSchema.parse(candidate);
  await (await database()).put("profiles", profile);
  return profile;
}

export async function deleteAnkiImportProfile(id: string): Promise<void> {
  await (await database()).delete("profiles", id);
}
