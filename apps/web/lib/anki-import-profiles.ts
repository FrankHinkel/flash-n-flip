import { openDB } from "idb";

import {
  ankiImportProfileSchema,
  type AnkiImportProfile,
} from "@flashcards/domain/anki-import-profile";
import { localProductRepository } from "./local-product-repository";

const database = () =>
  openDB("flash-n-flip-anki-import-profiles-v1", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
    },
  });

const migrateLegacyProfiles = async (): Promise<void> => {
  const legacy = await database();
  if (await legacy.get("meta", "local-authority-migrated")) return;
  const repository = await localProductRepository();
  const values = await legacy.getAll("profiles");
  for (const value of values) {
    const parsed = ankiImportProfileSchema.safeParse(value);
    if (parsed.success) await repository.saveAnkiImportProfile(parsed.data);
  }
  const transaction = legacy.transaction(["profiles", "meta"], "readwrite");
  await transaction.objectStore("profiles").clear();
  await transaction.objectStore("meta").put(true, "local-authority-migrated");
  await transaction.done;
};

const announceProfileChange = (): void => {
  globalThis.window?.dispatchEvent(
    new CustomEvent("flash-n-flip:decks-changed"),
  );
};

export async function storedAnkiImportProfiles(): Promise<AnkiImportProfile[]> {
  await migrateLegacyProfiles();
  return (await (await localProductRepository()).listAnkiImportProfiles())
    .map((entity) => entity.payload.profile)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveAnkiImportProfile(
  candidate: AnkiImportProfile,
): Promise<AnkiImportProfile> {
  const profile = ankiImportProfileSchema.parse(candidate);
  await migrateLegacyProfiles();
  const saved = await (
    await localProductRepository()
  ).saveAnkiImportProfile(profile);
  announceProfileChange();
  return saved;
}

export async function deleteAnkiImportProfile(id: string): Promise<void> {
  await migrateLegacyProfiles();
  await (await localProductRepository()).deleteAnkiImportProfile(id);
  announceProfileChange();
}
