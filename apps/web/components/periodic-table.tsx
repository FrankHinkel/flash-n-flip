"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  periodicTableElementByAtomicNumber,
  positionedPeriodicTableElements,
  type PeriodicTableProgram,
} from "../lib/periodic-table";
import {
  mediaPresentationBackground,
  mediaPresentationLengthCss,
  type MediaPresentation,
} from "../lib/media-presentation";
import { useMediaPresentationHeight } from "../lib/use-media-presentation";
import { useI18n } from "./i18n-provider";

const categoryLabels: Readonly<Record<string, string>> = {
  "alkali-metal": "Alkali metal",
  "alkaline-earth-metal": "Alkaline earth metal",
  "transition-metal": "Transition metal",
  "post-transition-metal": "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Nonmetal",
  halogen: "Halogen",
  "noble-gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
  unknown: "Unknown",
};

export function PeriodicTable({
  program,
  presentation,
}: {
  program: PeriodicTableProgram;
  presentation: MediaPresentation;
}) {
  const { text } = useI18n();
  const figureRef = useRef<HTMLElement | null>(null);
  const initialAtomicNumber = program.focusAtomicNumber ?? 1;
  const [selectedAtomicNumber, setSelectedAtomicNumber] =
    useState(initialAtomicNumber);
  const [hoveredAtomicNumber, setHoveredAtomicNumber] = useState<number | null>(
    null,
  );
  const selected = periodicTableElementByAtomicNumber(selectedAtomicNumber)!;
  const displayed =
    periodicTableElementByAtomicNumber(
      hoveredAtomicNumber ?? selectedAtomicNumber,
    ) ?? selected;
  const focusSet = useMemo(
    () =>
      new Set([
        ...program.highlightedAtomicNumbers,
        ...(program.focusAtomicNumber ? [program.focusAtomicNumber] : []),
      ]),
    [program.focusAtomicNumber, program.highlightedAtomicNumbers],
  );
  const requestedHeight = useMediaPresentationHeight(
    figureRef,
    presentation.height,
  );

  useEffect(() => {
    setSelectedAtomicNumber(program.focusAtomicNumber ?? 1);
    setHoveredAtomicNumber(null);
  }, [program.focusAtomicNumber]);

  const selectRelative = (delta: number) => {
    setSelectedAtomicNumber((current) =>
      Math.min(118, Math.max(1, current + delta)),
    );
  };

  return (
    <figure
      className="periodic-table"
      data-periodic-table={program.mode.toLowerCase()}
      ref={figureRef}
      style={{ width: mediaPresentationLengthCss(presentation.width) }}
    >
      <figcaption className="sr-only">{program.description}</figcaption>
      <div
        className="periodic-table-viewport"
        style={{
          background: mediaPresentationBackground(presentation.background),
          height: requestedHeight,
        }}
      >
        {program.mode === "EXPLORE" ? (
          <div className="periodic-table-toolbar">
            <button
              type="button"
              aria-label={text("rich.periodicTable.previous")}
              disabled={selectedAtomicNumber <= 1}
              onClick={() => selectRelative(-1)}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <label>
              <span className="sr-only">
                {text("rich.periodicTable.select")}
              </span>
              <select
                aria-label={text("rich.periodicTable.select")}
                value={selectedAtomicNumber}
                onChange={(event) =>
                  setSelectedAtomicNumber(Number(event.target.value))
                }
              >
                {positionedPeriodicTableElements
                  .slice()
                  .sort((left, right) => left.atomicNumber - right.atomicNumber)
                  .map((element) => (
                    <option
                      key={element.atomicNumber}
                      value={element.atomicNumber}
                    >
                      {element.atomicNumber} · {element.symbol} · {element.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={text("rich.periodicTable.next")}
              disabled={selectedAtomicNumber >= 118}
              onClick={() => selectRelative(1)}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          </div>
        ) : null}

        <div
          className="periodic-table-grid"
          role={program.mode === "QUIZ" ? "img" : "group"}
          aria-label={program.title || text("rich.periodicTable.label")}
        >
          {Array.from({ length: 18 }, (_, index) => (
            <span
              aria-hidden="true"
              className="periodic-table-group-number"
              key={`group-${index + 1}`}
              style={{ gridColumn: index + 1, gridRow: 1 }}
            >
              {index + 1}
            </span>
          ))}
          {positionedPeriodicTableElements.map((element) => {
            const active =
              program.mode === "EXPLORE" &&
              selectedAtomicNumber === element.atomicNumber;
            const emphasized = focusSet.has(element.atomicNumber);
            const content = (
              <>
                <small>{element.atomicNumber}</small>
                <strong>{element.symbol}</strong>
              </>
            );
            const className = [
              "periodic-table-element",
              `periodic-table-element-${element.categoryKey}`,
              active ? "is-selected" : "",
              emphasized ? "is-emphasized" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const style = {
              gridColumn: element.column,
              gridRow: element.row + 1 + (element.row >= 8 ? 1 : 0),
            };
            return program.mode === "EXPLORE" ? (
              <button
                type="button"
                aria-label={`${element.atomicNumber}, ${element.symbol}, ${element.name}, ${categoryLabels[element.categoryKey]}`}
                aria-pressed={active}
                className={className}
                key={element.atomicNumber}
                onClick={() => setSelectedAtomicNumber(element.atomicNumber)}
                onFocus={() => setHoveredAtomicNumber(element.atomicNumber)}
                onBlur={() => setHoveredAtomicNumber(null)}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse")
                    setHoveredAtomicNumber(element.atomicNumber);
                }}
                onPointerLeave={() => setHoveredAtomicNumber(null)}
                style={style}
              >
                {content}
              </button>
            ) : (
              <span
                className={className}
                key={element.atomicNumber}
                style={style}
              >
                {content}
              </span>
            );
          })}
        </div>

        {program.mode === "EXPLORE" ? (
          <dl className="periodic-table-details">
            <div className="periodic-table-identity">
              <dt>{text("rich.periodicTable.atomicNumber")}</dt>
              <dd>{displayed.atomicNumber}</dd>
              <strong aria-hidden="true">{displayed.symbol}</strong>
              <span>{displayed.name}</span>
            </div>
            <div>
              <dt>{text("rich.periodicTable.atomicMass")}</dt>
              <dd>{displayed.atomicMass}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.group")}</dt>
              <dd>{displayed.group ?? text("rich.periodicTable.fBlock")}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.period")}</dt>
              <dd>{displayed.period}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.category")}</dt>
              <dd>{categoryLabels[displayed.categoryKey]}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.electronConfiguration")}</dt>
              <dd>{displayed.electronConfiguration || "—"}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.electronegativity")}</dt>
              <dd>{displayed.electronegativity ?? "—"}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.standardState")}</dt>
              <dd>{displayed.standardState || "—"}</dd>
            </div>
            <div>
              <dt>{text("rich.periodicTable.discovered")}</dt>
              <dd>{displayed.yearDiscovered || "—"}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </figure>
  );
}
