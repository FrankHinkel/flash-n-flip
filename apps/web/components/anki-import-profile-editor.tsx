"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  AnkiFieldRole,
  AnkiImportPreview,
  AnkiImportProfile,
  AnkiImportProfileSelection,
  AnkiProfileOutput,
} from "@flashcards/api-client";
import {
  ankiProfileTemplateFields,
  xefjordAnkiProfileId,
} from "@flashcards/domain/anki-import-profile";

import {
  deleteAnkiImportProfile,
  saveAnkiImportProfile,
  storedAnkiImportProfiles,
} from "../lib/anki-import-profiles";

type Text = (english: string, german: string) => string;

const slug = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "card";

const defaultOutput = (
  noteType: AnkiImportPreview["noteTypes"][number],
  mapping: Record<string, AnkiFieldRole>,
): AnkiProfileOutput => {
  const first =
    noteType.fields.find((field) => mapping[field.name] === "PRIMARY_A")
      ?.name ??
    noteType.fields[0]?.name ??
    "Front";
  const second =
    noteType.fields.find((field) => mapping[field.name] === "PRIMARY_B")
      ?.name ??
    noteType.fields.find((field) => field.name !== first)?.name ??
    first;
  return {
    id: `card-${slug(noteType.name)}`,
    name: `${first} → ${second}`,
    frontTemplate: `[[${first}]]`,
    backTemplate: `[[${second}]]`,
    requiredNonEmptyFields: [first, second],
    direction: "SOURCE_TO_TARGET",
    linkedToPrevious: false,
  };
};

export const createAnkiImportProfileFromPreview = (
  preview: AnkiImportPreview,
  mappings: Record<string, Record<string, AnkiFieldRole>>,
): AnkiImportProfile => {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: `${preview.collectionTitle} profile`,
    description: "",
    createdAt: now,
    updatedAt: now,
    rules: preview.noteTypes.map((noteType, index) => {
      const output = defaultOutput(
        noteType,
        mappings[noteType.sourceNoteTypeId] ?? {},
      );
      return {
        id: `rule-${index + 1}-${slug(noteType.name)}`,
        noteTypeName: noteType.name,
        requiredFields: [...output.requiredNonEmptyFields],
        outputs: [output],
      };
    }),
  };
};

const profileMatchesPreview = (
  profile: AnkiImportProfile,
  preview: AnkiImportPreview,
): boolean =>
  preview.noteTypes.every((noteType) => {
    const available = new Set(
      noteType.fields.map((field) => field.name.toLowerCase()),
    );
    return profile.rules.some(
      (rule) =>
        rule.noteTypeName.toLowerCase() === noteType.name.toLowerCase() &&
        rule.requiredFields.every((field) =>
          available.has(field.toLowerCase()),
        ),
    );
  });

export function AnkiImportProfileEditor({
  preview,
  mappings,
  selection,
  onSelectionChange,
  text,
}: {
  preview: AnkiImportPreview;
  mappings: Record<string, Record<string, AnkiFieldRole>>;
  selection?: AnkiImportProfileSelection;
  onSelectionChange: (
    selection: AnkiImportProfileSelection | undefined,
  ) => void;
  text: Text;
}) {
  const [profiles, setProfiles] = useState<AnkiImportProfile[]>([]);
  const [draft, setDraft] = useState<AnkiImportProfile | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void storedAnkiImportProfiles().then(setProfiles);
  }, []);

  const compatibleProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesPreview(profile, preview)),
    [preview, profiles],
  );
  const selectedValue =
    selection?.kind === "BUILT_IN"
      ? selection.profileId
      : selection?.kind === "CUSTOM"
        ? selection.profile.id
        : "STANDARD";

  const updateOutput = (
    ruleIndex: number,
    outputIndex: number,
    update: Partial<AnkiProfileOutput>,
  ) =>
    setDraft((current) => {
      if (!current) return current;
      const rules = current.rules.map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex
          ? {
              ...rule,
              outputs: rule.outputs.map((output, currentOutputIndex) =>
                currentOutputIndex === outputIndex
                  ? { ...output, ...update }
                  : output,
              ),
            }
          : rule,
      );
      return { ...current, rules };
    });

  const saveDraft = async () => {
    if (!draft) return;
    try {
      const updatedAt = new Date().toISOString();
      const completed: AnkiImportProfile = {
        ...draft,
        updatedAt,
        rules: draft.rules.map((rule) => ({
          ...rule,
          requiredFields: [
            ...new Set(
              rule.outputs.flatMap((output) => [
                ...ankiProfileTemplateFields(output.frontTemplate),
                ...ankiProfileTemplateFields(output.backTemplate),
                ...output.requiredNonEmptyFields,
              ]),
            ),
          ],
        })),
      };
      const saved = await saveAnkiImportProfile(completed);
      setProfiles((current) => [
        ...current.filter((profile) => profile.id !== saved.id),
        saved,
      ]);
      onSelectionChange({ kind: "CUSTOM", profile: saved });
      setDraft(null);
      setStatus(text("Profile saved locally.", "Profil lokal gespeichert."));
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : text(
              "The profile could not be saved.",
              "Das Profil konnte nicht gespeichert werden.",
            ),
      );
    }
  };

  return (
    <section
      className="anki-profile-panel"
      aria-labelledby="anki-profile-title"
    >
      <div>
        <span className="eyebrow">
          {text("Import profile", "Importprofil")}
        </span>
        <h3 id="anki-profile-title">
          {text(
            "Choose or create a card layout",
            "Kartenlayout wählen oder erstellen",
          )}
        </h3>
      </div>
      <p>
        {text(
          "Profiles turn Anki fields into safe Wiki templates. A note can create several question-and-answer cards.",
          "Profile setzen Anki-Felder in sichere Wiki-Vorlagen ein. Eine Notiz kann mehrere Frage-Antwort-Karten erzeugen.",
        )}
      </p>
      <label>
        {text("Active profile", "Aktives Profil")}
        <select
          value={selectedValue}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(null);
            setStatus("");
            if (value === "STANDARD") onSelectionChange(undefined);
            else if (value === xefjordAnkiProfileId) {
              onSelectionChange({
                kind: "BUILT_IN",
                profileId: xefjordAnkiProfileId,
              });
            } else {
              const profile = profiles.find(
                (candidate) => candidate.id === value,
              );
              if (profile) onSelectionChange({ kind: "CUSTOM", profile });
            }
          }}
        >
          <option value="STANDARD">
            {text("Standard field assignment", "Standard-Feldzuordnung")}
          </option>
          {preview.xefjordPreset.detected && (
            <option
              value={xefjordAnkiProfileId}
              disabled={!preview.xefjordPreset.directImportAvailable}
            >
              Xefjord&apos;s Complete · {text("built in", "integriert")}
            </option>
          )}
          {compatibleProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      <div className="anki-profile-actions">
        <button
          type="button"
          onClick={() => {
            setDraft(createAnkiImportProfileFromPreview(preview, mappings));
            setStatus("");
          }}
        >
          <Plus aria-hidden="true" />
          {text("New profile", "Neues Profil")}
        </button>
        {selection?.kind === "CUSTOM" && (
          <>
            <button
              type="button"
              onClick={() => setDraft(structuredClone(selection.profile))}
            >
              {text("Edit profile", "Profil bearbeiten")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  !window.confirm(
                    text(
                      `Delete the import profile “${selection.profile.name}”?`,
                      `Importprofil „${selection.profile.name}“ löschen?`,
                    ),
                  )
                ) {
                  return;
                }
                void deleteAnkiImportProfile(selection.profile.id).then(() => {
                  setProfiles((current) =>
                    current.filter(
                      (profile) => profile.id !== selection.profile.id,
                    ),
                  );
                  onSelectionChange(undefined);
                  setStatus(text("Profile deleted.", "Profil gelöscht."));
                });
              }}
            >
              <Trash2 aria-hidden="true" />
              {text("Delete", "Löschen")}
            </button>
          </>
        )}
      </div>
      {draft && (
        <div className="anki-profile-editor">
          <label>
            {text("Profile name", "Profilname")}
            <input
              value={draft.name}
              maxLength={120}
              onChange={(event) =>
                setDraft(
                  (current) =>
                    current && { ...current, name: event.target.value },
                )
              }
            />
          </label>
          <label>
            {text("Description", "Beschreibung")}
            <textarea
              value={draft.description}
              maxLength={1000}
              onChange={(event) =>
                setDraft(
                  (current) =>
                    current && { ...current, description: event.target.value },
                )
              }
            />
          </label>
          {draft.rules.map((rule, ruleIndex) => (
            <fieldset key={rule.id}>
              <legend>{rule.noteTypeName}</legend>
              <p>
                {text("Available fields", "Verfügbare Felder")}:{" "}
                {preview.noteTypes[ruleIndex]?.fields
                  .map((field) => `[[${field.name}]]`)
                  .join(" · ")}
              </p>
              {rule.outputs.map((output, outputIndex) => (
                <div className="anki-profile-output" key={output.id}>
                  <label>
                    {text("Card name", "Kartenname")}
                    <input
                      value={output.name}
                      maxLength={120}
                      onChange={(event) =>
                        updateOutput(ruleIndex, outputIndex, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {text("Question · Wiki syntax", "Frage · Wiki-Syntax")}
                    <textarea
                      value={output.frontTemplate}
                      spellCheck={false}
                      onChange={(event) =>
                        updateOutput(ruleIndex, outputIndex, {
                          frontTemplate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {text("Answer · Wiki syntax", "Antwort · Wiki-Syntax")}
                    <textarea
                      value={output.backTemplate}
                      spellCheck={false}
                      onChange={(event) =>
                        updateOutput(ruleIndex, outputIndex, {
                          backTemplate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {text("Language direction", "Sprachrichtung")}
                    <select
                      value={output.direction}
                      onChange={(event) =>
                        updateOutput(ruleIndex, outputIndex, {
                          direction: event.target
                            .value as AnkiProfileOutput["direction"],
                        })
                      }
                    >
                      <option value="SOURCE_TO_TARGET">A → B</option>
                      <option value="TARGET_TO_SOURCE">B → A</option>
                    </select>
                  </label>
                  <label className="anki-profile-checkbox">
                    <input
                      type="checkbox"
                      checked={output.linkedToPrevious}
                      onChange={(event) =>
                        updateOutput(ruleIndex, outputIndex, {
                          linkedToPrevious: event.target.checked,
                        })
                      }
                    />
                    {text(
                      "Link to the previous generated card",
                      "Mit der vorherigen erzeugten Karte verknüpfen",
                    )}
                  </label>
                  {rule.outputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(
                          (current) =>
                            current && {
                              ...current,
                              rules: current.rules.map(
                                (candidate, currentRuleIndex) =>
                                  currentRuleIndex === ruleIndex
                                    ? {
                                        ...candidate,
                                        outputs: candidate.outputs.filter(
                                          (_, index) => index !== outputIndex,
                                        ),
                                      }
                                    : candidate,
                              ),
                            },
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" />
                      {text("Remove card", "Karte entfernen")}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDraft(
                    (current) =>
                      current && {
                        ...current,
                        rules: current.rules.map(
                          (candidate, currentRuleIndex) =>
                            currentRuleIndex === ruleIndex
                              ? {
                                  ...candidate,
                                  outputs: [
                                    ...candidate.outputs,
                                    {
                                      ...candidate.outputs[0]!,
                                      id: `card-${crypto.randomUUID()}`,
                                      name: text(
                                        "Additional card",
                                        "Weitere Karte",
                                      ),
                                      linkedToPrevious: false,
                                    },
                                  ],
                                }
                              : candidate,
                        ),
                      },
                  )
                }
              >
                <Plus aria-hidden="true" />
                {text("Add card", "Karte hinzufügen")}
              </button>
            </fieldset>
          ))}
          <div className="anki-profile-actions">
            <button type="button" onClick={() => void saveDraft()}>
              <Save aria-hidden="true" />
              {text("Save profile", "Profil speichern")}
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              {text("Cancel", "Abbrechen")}
            </button>
          </div>
        </div>
      )}
      {status && (
        <p className="anki-profile-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
