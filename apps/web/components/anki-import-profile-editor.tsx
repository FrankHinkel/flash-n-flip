"use client";

import { Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  AnkiFieldRole,
  AnkiImportPreview,
} from "@flashcards/domain/anki-import-plan";
import {
  ankiImportProfileSchema,
  ankiProfileTemplateFields,
  manualAnkiFieldMappingProfileId,
  xefjordAnkiProfileId,
  type AnkiImportProfile,
  type AnkiImportProfileSelection,
  type AnkiProfileConditionalSection,
  type AnkiProfileOutput,
} from "@flashcards/domain/anki-import-profile";
import { compileAnkiProfileTemplate } from "@flashcards/domain/anki-import-apply-profile";
import { cardContentSchema } from "@flashcards/domain/content";

import {
  deleteAnkiImportProfile,
  saveAnkiImportProfile,
  storedAnkiImportProfiles,
} from "../lib/anki-import-profiles";
import { ContentView } from "./content-view";

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
    frontSections: [],
    backSections: [],
    requiredNonEmptyFields: [first, second],
    direction: "SOURCE_TO_TARGET",
    linkedToPrevious: false,
    targetDeckPath: null,
  };
};

export const createAnkiImportProfileFromPreview = (
  preview: AnkiImportPreview,
  mappings: Record<string, Record<string, AnkiFieldRole>>,
): AnkiImportProfile => {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: `${preview.collectionTitle} profile`,
    description: "",
    createdAt: now,
    updatedAt: now,
    rules: preview.noteTypes
      .filter((noteType) => noteType.cardCount > 0)
      .map((noteType, index) => {
        const output = defaultOutput(
          noteType,
          mappings[noteType.sourceNoteTypeId] ?? {},
        );
        return {
          id: `rule-${index + 1}-${slug(noteType.name)}`,
          noteTypeName: noteType.name,
          requiredFields: [...output.requiredNonEmptyFields],
          noteTypeSignature: noteType.signature,
          sourceDeckPath: null,
          sourceTemplate: null,
          outputs: [output],
        };
      }),
  };
};

const profileMatchesPreview = (
  profile: AnkiImportProfile,
  preview: AnkiImportPreview,
): boolean =>
  preview.noteTypes
    .filter((noteType) => noteType.cardCount > 0)
    .every((noteType) => {
      const available = new Set(
        noteType.fields.map((field) => field.name.toLowerCase()),
      );
      return profile.rules.some(
        (rule) =>
          rule.noteTypeName.toLowerCase() === noteType.name.toLowerCase() &&
          (!rule.noteTypeSignature ||
            rule.noteTypeSignature === noteType.signature) &&
          rule.requiredFields.every((field) =>
            available.has(field.toLowerCase()),
          ),
      );
    });

const commaSeparatedFields = (value: string): string[] =>
  value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

function ProfileOutputPreview({
  output,
  noteType,
  text,
}: {
  output: AnkiProfileOutput;
  noteType: AnkiImportPreview["noteTypes"][number];
  text: Text;
}) {
  try {
    const fields = new Map(
      noteType.fields.map((field) => [field.name, field.sample]),
    );
    const front = cardContentSchema.parse(
      compileAnkiProfileTemplate(output.frontTemplate, fields),
    );
    const back = cardContentSchema.parse(
      compileAnkiProfileTemplate(output.backTemplate, fields),
    );
    return (
      <div className="anki-profile-card-preview">
        <section aria-label={text("Question preview", "Vorschau Frage")}>
          <strong>{text("Question", "Frage")}</strong>
          <ContentView content={front} speechEnabled={false} />
        </section>
        <section aria-label={text("Answer preview", "Vorschau Antwort")}>
          <strong>{text("Answer", "Antwort")}</strong>
          <ContentView content={back} answer speechEnabled={false} />
        </section>
      </div>
    );
  } catch (cause) {
    return (
      <p className="form-error" role="alert">
        {cause instanceof Error
          ? cause.message
          : text("Preview failed.", "Vorschau fehlgeschlagen.")}
      </p>
    );
  }
}

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
    const load = () => void storedAnkiImportProfiles().then(setProfiles);
    load();
    window.addEventListener("flash-n-flip:decks-changed", load);
    return () =>
      window.removeEventListener("flash-n-flip:decks-changed", load);
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
        : "AUTOMATIC";

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

  const updateRule = (
    ruleIndex: number,
    update: Partial<AnkiImportProfile["rules"][number]>,
  ) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            rules: current.rules.map((rule, index) =>
              index === ruleIndex ? { ...rule, ...update } : rule,
            ),
          }
        : current,
    );

  const updateSection = (
    ruleIndex: number,
    outputIndex: number,
    side: "frontSections" | "backSections",
    sectionIndex: number,
    update: Partial<AnkiProfileConditionalSection>,
  ) =>
    updateOutput(ruleIndex, outputIndex, {
      [side]: draft?.rules[ruleIndex]?.outputs[outputIndex]?.[side].map(
        (section, index) =>
          index === sectionIndex ? { ...section, ...update } : section,
      ),
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
                ...output.frontSections.flatMap((section) => [
                  ...ankiProfileTemplateFields(section.template),
                  ...section.whenAnyNonEmptyFields,
                  ...section.whenAllNonEmptyFields,
                ]),
                ...output.backSections.flatMap((section) => [
                  ...ankiProfileTemplateFields(section.template),
                  ...section.whenAnyNonEmptyFields,
                  ...section.whenAllNonEmptyFields,
                ]),
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

  const importProfileFile = async (file: File) => {
    try {
      if (file.size > 512 * 1024) {
        throw new Error(
          text(
            "The profile file exceeds 512 KiB.",
            "Die Profildatei ist größer als 512 KiB.",
          ),
        );
      }
      const profile = ankiImportProfileSchema.parse(
        JSON.parse(await file.text()),
      );
      const saved = await saveAnkiImportProfile({
        ...profile,
        id: crypto.randomUUID(),
        name: `${profile.name} · ${text("imported", "importiert")}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setProfiles((current) => [
        ...current.filter((candidate) => candidate.id !== saved.id),
        saved,
      ]);
      onSelectionChange({ kind: "CUSTOM", profile: saved });
      setStatus(text("Profile imported locally.", "Profil lokal importiert."));
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : text("Profile import failed.", "Profilimport fehlgeschlagen."),
      );
    }
  };

  const exportSelectedProfile = () => {
    if (selection?.kind !== "CUSTOM") return;
    const blob = new Blob([JSON.stringify(selection.profile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(selection.profile.name)}.fnf-anki-profile.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="anki-profile-panel"
      aria-labelledby="anki-profile-title"
    >
      <div>
        <span className="eyebrow">
          {text("Import behavior", "Importverhalten")}
        </span>
        <h3 id="anki-profile-title">
          {text(
            "Use Anki's card layouts automatically",
            "Anki-Kartenlayouts automatisch übernehmen",
          )}
        </h3>
      </div>
      <p>
        {text(
          "By default, Flash-n-Flip reads every used Anki note type and template directly. Manual field assignment and custom profiles are correction tools for exceptional decks.",
          "Standardmäßig liest Flash-n-Flip jeden verwendeten Anki-Notiztyp und jede Kartenvorlage direkt. Manuelle Feldzuordnung und eigene Profile sind Korrekturwerkzeuge für Ausnahmefälle.",
        )}
      </p>
      <label>
        {text("Import method", "Importmethode")}
        <select
          value={selectedValue}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(null);
            setStatus("");
            if (value === "AUTOMATIC") onSelectionChange(undefined);
            else if (
              value === xefjordAnkiProfileId ||
              value === manualAnkiFieldMappingProfileId
            ) {
              onSelectionChange({
                kind: "BUILT_IN",
                profileId: value,
              });
            } else {
              const profile = profiles.find(
                (candidate) => candidate.id === value,
              );
              if (profile) onSelectionChange({ kind: "CUSTOM", profile });
            }
          }}
        >
          <option value="AUTOMATIC">
            {text(
              "Automatic",
              "Automatisch",
            )}
          </option>
          <option value={manualAnkiFieldMappingProfileId}>
            {text(
              "Manual correction",
              "Manuelle Korrektur",
            )}
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
          {text("Advanced correction profile", "Erweitertes Korrekturprofil")}
        </button>
        <label className="anki-profile-file-action">
          <Upload aria-hidden="true" />
          {text("Import profile", "Profil importieren")}
          <input
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void importProfileFile(selected);
              event.target.value = "";
            }}
          />
        </label>
        {selection?.kind === "CUSTOM" && (
          <>
            <button type="button" onClick={exportSelectedProfile}>
              <Download aria-hidden="true" />
              {text("Export profile", "Profil exportieren")}
            </button>
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
              <div className="anki-profile-match-grid">
                <label>
                  {text(
                    "Source deck path (optional, * / **)",
                    "Quell-Deckpfad (optional, * / **)",
                  )}
                  <input
                    value={rule.sourceDeckPath ?? ""}
                    maxLength={500}
                    placeholder="Allgemeinwissen/**"
                    onChange={(event) =>
                      updateRule(ruleIndex, {
                        sourceDeckPath: event.target.value.trim() || null,
                      })
                    }
                  />
                </label>
                <label>
                  {text(
                    "Source Anki template (optional)",
                    "Anki-Quellvorlage (optional)",
                  )}
                  <select
                    value={
                      rule.sourceTemplate?.ord === undefined
                        ? ""
                        : String(rule.sourceTemplate.ord)
                    }
                    onChange={(event) => {
                      const ord = event.target.value
                        ? Number(event.target.value)
                        : null;
                      const noteType = preview.noteTypes.find(
                        (candidate) =>
                          candidate.signature === rule.noteTypeSignature,
                      );
                      const template = noteType?.templates.find(
                        (candidate) => candidate.ord === ord,
                      );
                      updateRule(ruleIndex, {
                        sourceTemplate:
                          ord === null ? null : { ord, name: template?.name },
                      });
                    }}
                  >
                    <option value="">
                      {text("All templates", "Alle Vorlagen")}
                    </option>
                    {preview.noteTypes
                      .find(
                        (candidate) =>
                          candidate.signature === rule.noteTypeSignature,
                      )
                      ?.templates.filter((template) => template.cardCount > 0)
                      .map((template) => (
                        <option key={template.ord} value={template.ord}>
                          {template.name} ·{" "}
                          {template.cardCount.toLocaleString()}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
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
                  <label>
                    {text(
                      "Target deck path (optional, separated by /)",
                      "Zieldeckpfad (optional, mit / getrennt)",
                    )}
                    <input
                      value={output.targetDeckPath?.join("/") ?? ""}
                      placeholder="Sprachen/Deutsch/Wortschatz"
                      onChange={(event) => {
                        const path = event.target.value
                          .split("/")
                          .map((part) => part.trim())
                          .filter(Boolean);
                        updateOutput(ruleIndex, outputIndex, {
                          targetDeckPath: path.length ? path : null,
                        });
                      }}
                    />
                  </label>
                  {(
                    [
                      ["frontSections", text("Question", "Frage")],
                      ["backSections", text("Answer", "Antwort")],
                    ] as const
                  ).map(([side, sideLabel]) => (
                    <div className="anki-profile-sections" key={side}>
                      <strong>
                        {text(
                          `${sideLabel} · optional sections`,
                          `${sideLabel} · optionale Abschnitte`,
                        )}
                      </strong>
                      {output[side].map((section, sectionIndex) => (
                        <fieldset key={section.id}>
                          <legend>
                            {text("Optional section", "Optionaler Abschnitt")}
                          </legend>
                          <label>
                            {text("Wiki syntax", "Wiki-Syntax")}
                            <textarea
                              value={section.template}
                              spellCheck={false}
                              onChange={(event) =>
                                updateSection(
                                  ruleIndex,
                                  outputIndex,
                                  side,
                                  sectionIndex,
                                  { template: event.target.value },
                                )
                              }
                            />
                          </label>
                          <label>
                            {text(
                              "Show when any field is filled (comma-separated)",
                              "Anzeigen, wenn eines dieser Felder gefüllt ist (kommagetrennt)",
                            )}
                            <input
                              value={section.whenAnyNonEmptyFields.join(", ")}
                              onChange={(event) =>
                                updateSection(
                                  ruleIndex,
                                  outputIndex,
                                  side,
                                  sectionIndex,
                                  {
                                    whenAnyNonEmptyFields: commaSeparatedFields(
                                      event.target.value,
                                    ),
                                  },
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateOutput(ruleIndex, outputIndex, {
                                [side]: output[side].filter(
                                  (_, index) => index !== sectionIndex,
                                ),
                              })
                            }
                          >
                            <Trash2 aria-hidden="true" />
                            {text("Remove section", "Abschnitt entfernen")}
                          </button>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateOutput(ruleIndex, outputIndex, {
                            [side]: [
                              ...output[side],
                              {
                                id: `section-${crypto.randomUUID()}`,
                                template: `## Details\n\n[[${rule.requiredFields[0]}]]`,
                                whenAnyNonEmptyFields: [
                                  rule.requiredFields[0]!,
                                ],
                                whenAllNonEmptyFields: [],
                              },
                            ],
                          })
                        }
                      >
                        <Plus aria-hidden="true" />
                        {text(
                          "Add optional section",
                          "Optionalen Abschnitt hinzufügen",
                        )}
                      </button>
                    </div>
                  ))}
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
                  <ProfileOutputPreview
                    output={output}
                    noteType={
                      preview.noteTypes.find(
                        (candidate) =>
                          candidate.signature === rule.noteTypeSignature,
                      ) ?? preview.noteTypes[ruleIndex]!
                    }
                    text={text}
                  />
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
