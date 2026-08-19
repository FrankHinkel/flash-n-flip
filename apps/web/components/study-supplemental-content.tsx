"use client";

import { Check, Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { CardContent } from "@flashcards/domain/content";
import {
  cardContentPlainText,
  hasCardContent,
} from "@flashcards/domain/content";
import type { ContentStyleDefinition } from "@flashcards/domain/content-style";

import { ContentView } from "./content-view";

type SupplementalItem = { label: string; content: CardContent };

const compactText = (content: CardContent): string =>
  cardContentPlainText(content).replace(/\s+/g, " ").trim();

const isShortText = (item: SupplementalItem): boolean =>
  compactText(item.content).length <= 160 &&
  item.content.blocks.every((block) =>
    ["text", "heading", "list", "markdown"].includes(block.type),
  );

export function StudySupplementalContent({
  cardId,
  items,
  locale,
  uiLocale,
  contentStyles,
}: {
  cardId: string;
  items: readonly SupplementalItem[];
  locale: string;
  uiLocale: string;
  contentStyles?: readonly ContentStyleDefinition[];
}) {
  const available = items.filter(
    (item) => item.label.trim() && hasCardContent(item.content),
  );
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const germanUi = uiLocale.split("-")[0] === "de";

  useEffect(() => {
    setOpen(false);
    setSelectedIndex(null);
  }, [cardId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!available.length) return null;
  const selected =
    selectedIndex === null ? null : (available[selectedIndex] ?? null);
  const triggerLabel = germanUi
    ? "Zusatzinhalte anzeigen"
    : "Show additional content";

  return (
    <div className="study-supplemental" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="study-supplemental-trigger"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={panelId}
        title={triggerLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <Info aria-hidden="true" size={24} />
      </button>
      {open ? (
        <div
          className="study-supplemental-popover"
          id={panelId}
          role="dialog"
          aria-label={
            germanUi
              ? "Verfügbare Zusatzinhalte"
              : "Available additional content"
          }
        >
          <div className="study-supplemental-list">
            {available.map((item, index) => {
              const text = compactText(item.content);
              const short = isShortText(item);
              const active = selectedIndex === index;
              return (
                <button
                  type="button"
                  className="study-supplemental-item"
                  aria-pressed={active}
                  key={`${item.label}:${index}`}
                  onClick={() => setSelectedIndex(active ? null : index)}
                >
                  <span className="study-supplemental-item-heading">
                    <strong>{item.label}</strong>
                    {active ? <Check aria-hidden="true" size={18} /> : null}
                  </span>
                  {text ? (
                    <span className={short ? "" : "is-preview"}>{text}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {selected && !isShortText(selected) ? (
            <section
              className="study-supplemental-detail"
              aria-label={selected.label}
            >
              <ContentView
                content={selected.content}
                locale={locale}
                contentStyles={contentStyles}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
