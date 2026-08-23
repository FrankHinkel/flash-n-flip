"use client";

import { Square, Volume2, VolumeX } from "lucide-react";
import { useId, type ReactNode } from "react";
import {
  markdownToRichTextDocument,
  normalizeAnkiClozeMath,
  resolveMarkdownClozeRevealMode,
  type CardContent,
  type ContentBlock,
} from "@flashcards/domain/content";
import type { ContentStyleDefinition } from "@flashcards/domain/content-style";

import {
  AuthenticatedImageOverlay,
  AuthenticatedMedia,
} from "./authenticated-media";
import { EuropeMap } from "./europe-map";
import { MathContent, RichTextContent } from "./rich-text-content";
import { markdownSyntaxMessage } from "./markdown-errors";
import { MermaidDiagram } from "./mermaid-diagram";
import { MusicScore } from "./music-score";
import { TrustedGraphic } from "./trusted-graphic";
import {
  cardContentToSpeechSegments,
  clozeChoiceToSpeechText,
} from "./speech-text";
import { visibleStudyContentBlocks } from "./study-content";
import { speechVoiceInstallHint, useTextToSpeech } from "./use-text-to-speech";

type ClozeBlock = Extract<ContentBlock, { type: "cloze" }>;

function AnkiClozeContent({
  block,
  answer,
  locale,
}: {
  block: ClozeBlock;
  answer: boolean;
  locale: string;
}) {
  const activeId = block.activeDeletionId;
  if (block.presentation !== "ANKI" || activeId === undefined) {
    return <p>{block.text}</p>;
  }
  const normalized =
    (block.mathRanges?.length ?? 0) > 0 ? block : normalizeAnkiClozeMath(block);
  const mathRanges = normalized.mathRanges ?? [];
  const activeRanges = normalized.deletions
    .filter((deletion) => deletion.id === activeId)
    .sort((left, right) => left.start - right.start);
  const german = locale.split("-")[0] === "de";
  const blank = (hint?: string, key?: string) => (
    <span
      className="anki-cloze-blank"
      aria-label={
        hint
          ? german
            ? `Lücke, Hinweis: ${hint}`
            : `Blank, hint: ${hint}`
          : german
            ? "Lücke"
            : "Blank"
      }
      key={key}
    >
      [{hint || "…"}]
    </span>
  );
  const plainParts = (start: number, end: number, key: string): ReactNode[] => {
    const result: ReactNode[] = [];
    let cursor = start;
    for (const deletion of activeRanges) {
      const overlapStart = Math.max(start, deletion.start);
      const overlapEnd = Math.min(end, deletion.end);
      if (overlapStart >= overlapEnd) continue;
      if (overlapStart > cursor) {
        result.push(
          <span key={`${key}-text-${cursor}`}>
            {normalized.text.slice(cursor, overlapStart)}
          </span>,
        );
      }
      result.push(
        answer ? (
          <mark
            className="anki-cloze-answer"
            key={`${key}-answer-${overlapStart}`}
          >
            {normalized.text.slice(overlapStart, overlapEnd)}
          </mark>
        ) : (
          blank(deletion.hint, `${key}-blank-${overlapStart}`)
        ),
      );
      cursor = overlapEnd;
    }
    if (cursor < end) {
      result.push(
        <span key={`${key}-text-${cursor}`}>
          {normalized.text.slice(cursor, end)}
        </span>,
      );
    }
    return result;
  };
  const rendered: ReactNode[] = [];
  let cursor = 0;
  mathRanges.forEach((math, index) => {
    rendered.push(...plainParts(cursor, math.start, `before-${index}`));
    const overlaps = activeRanges.filter(
      (deletion) => deletion.start < math.end && deletion.end > math.start,
    );
    const fullyHidden = overlaps.some(
      (deletion) => deletion.start <= math.start && deletion.end >= math.end,
    );
    if (fullyHidden && !answer) {
      rendered.push(blank(overlaps[0]?.hint, `math-blank-${index}`));
    } else if (fullyHidden) {
      const AnswerContainer = math.display ? "div" : "mark";
      rendered.push(
        <AnswerContainer
          className="anki-cloze-answer"
          key={`math-answer-${index}`}
        >
          <MathContent display={math.display} latex={math.latex} />
        </AnswerContainer>,
      );
    } else {
      let latex = math.latex;
      for (const deletion of [...overlaps].sort(
        (left, right) => right.start - left.start,
      )) {
        const start = Math.max(0, deletion.start - math.start);
        const end = Math.min(latex.length, deletion.end - math.start);
        const source = latex.slice(start, end);
        latex = `${latex.slice(0, start)}\\boxed{${answer ? source : `\\phantom{${source}}`}}${latex.slice(end)}`;
      }
      const MathContainer = math.display ? "div" : "span";
      rendered.push(
        <MathContainer
          className={overlaps.length ? "anki-cloze-math-partial" : undefined}
          key={`math-${index}`}
        >
          <MathContent display={math.display} latex={latex} />
        </MathContainer>,
      );
    }
    cursor = math.end;
  });
  rendered.push(...plainParts(cursor, normalized.text.length, "after"));
  return <div className="anki-cloze-text">{rendered}</div>;
}

export function ContentView({
  content,
  locale = "en",
  exploreMap = false,
  skipFirstHeading = false,
  answer = false,
  shuffleSeed,
  securelyRecognizedCardIds,
  mapQuizTargetRegionCode,
  mapQuizRevealed = false,
  onMapQuizRegionSelect,
  onClozeCorrect,
  onClozeIncorrect,
  onClozeHint,
  speechEnabled = false,
  speechUiLocale = locale,
  speechLocale = locale,
  speechAlternateLocale,
  contentStyles = [],
}: {
  content: CardContent;
  locale?: string;
  exploreMap?: boolean;
  skipFirstHeading?: boolean;
  answer?: boolean;
  shuffleSeed?: string;
  securelyRecognizedCardIds?: readonly string[];
  mapQuizTargetRegionCode?: string;
  mapQuizRevealed?: boolean;
  onMapQuizRegionSelect?: (regionCode: string) => void;
  onClozeCorrect?: (clozeId: string) => void;
  onClozeIncorrect?: () => void;
  onClozeHint?: () => void;
  speechEnabled?: boolean;
  speechUiLocale?: string;
  speechLocale?: string;
  speechAlternateLocale?: string;
  contentStyles?: readonly ContentStyleDefinition[];
}) {
  const blocks = visibleStudyContentBlocks(content, skipFirstHeading);
  const speechSegments = cardContentToSpeechSegments(
    content,
    answer,
    speechLocale,
    speechAlternateLocale,
  );
  const speechLocales = [
    ...new Set([
      speechLocale,
      ...speechSegments.map((segment) => segment.locale),
    ]),
  ];
  const speech = useTextToSpeech(speechLocales, speechEnabled);
  const speechText = speechSegments.map((segment) => segment.text).join(" ");
  const speechIsActive = speech.speakingText === speechText;
  const speechUnavailable = speech.controlVisible && !speech.canSpeak;
  const speechUnavailableHintId = useId();
  const installVoiceHint = speechVoiceInstallHint(
    speech.missingLocales,
    speechUiLocale,
  );
  const germanUi = speechUiLocale.split("-")[0] === "de";
  const speechControl =
    speech.controlVisible && speechText ? (
      <>
        <button
          type="button"
          className="card-speech-button"
          aria-disabled={speechUnavailable || undefined}
          aria-describedby={
            speechUnavailable ? speechUnavailableHintId : undefined
          }
          aria-label={
            speechUnavailable
              ? germanUi
                ? "Vorlesen nicht verfügbar"
                : "Text to speech unavailable"
              : speechIsActive
                ? germanUi
                  ? "Vorlesen stoppen"
                  : "Stop reading"
                : answer
                  ? germanUi
                    ? "Vollständige Antwort vorlesen"
                    : "Read completed answer"
                  : germanUi
                    ? "Satz mit Lücken vorlesen"
                    : "Read sentence with blanks"
          }
          title={
            speechUnavailable
              ? installVoiceHint
              : answer
                ? germanUi
                  ? "Vollständige Antwort vorlesen"
                  : "Read completed answer"
                : germanUi
                  ? "Satz mit Sprechpausen vorlesen"
                  : "Read sentence with spoken pauses"
          }
          onClick={(event) => {
            event.stopPropagation();
            if (speechUnavailable) return;
            speech.speak(speechSegments);
          }}
        >
          {speechUnavailable ? (
            <VolumeX aria-hidden="true" size={19} />
          ) : speechIsActive ? (
            <Square aria-hidden="true" size={17} />
          ) : (
            <Volume2 aria-hidden="true" size={19} />
          )}
        </button>
        {speechUnavailable ? (
          <span className="sr-only" id={speechUnavailableHintId}>
            {installVoiceHint}
          </span>
        ) : null}
      </>
    ) : null;
  const speechAnchorIndex = speechControl
    ? blocks.reduce(
        (lastIndex, block, index) =>
          block.type === "heading" ||
          block.type === "list" ||
          block.type === "formula" ||
          block.type === "cloze" ||
          block.type === "richText" ||
          block.type === "markdown" ||
          block.type === "mermaidDiagram" ||
          block.type === "musicScore" ||
          block.type === "text"
            ? index
            : lastIndex,
        -1,
      )
    : -1;
  const withSpeechControl = (index: number, content: ReactNode) => (
    <>
      {content}
      {index === speechAnchorIndex ? speechControl : null}
    </>
  );

  return (
    <div className="card-content">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2 key={key}>{withSpeechControl(index, block.text)}</h2>
          ) : (
            <h3 key={key}>{withSpeechControl(index, block.text)}</h3>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={item}>
                  {itemIndex === block.items.length - 1
                    ? withSpeechControl(index, item)
                    : item}
                </li>
              ))}
            </List>
          );
        }
        if (block.type === "formula") {
          return (
            <span className="card-inline-speech-group" key={key}>
              <code className="formula">{block.latex}</code>
              {index === speechAnchorIndex ? speechControl : null}
            </span>
          );
        }
        if (block.type === "mermaidDiagram") {
          return (
            <span className="card-inline-speech-group" key={key}>
              <MermaidDiagram block={block} />
              {index === speechAnchorIndex ? speechControl : null}
            </span>
          );
        }
        if (block.type === "musicScore") {
          return (
            <span className="card-inline-speech-group" key={key}>
              <MusicScore
                score={{
                  ...block,
                  locale: locale.split("-")[0] === "de" ? "de" : "en",
                }}
              />
              {index === speechAnchorIndex ? speechControl : null}
            </span>
          );
        }
        if (block.type === "image") {
          return (
            <AuthenticatedMedia
              key={key}
              kind="image"
              mediaId={block.mediaId}
              alt={block.alt}
              decorative={block.decorative}
            />
          );
        }
        if (block.type === "imageOverlay") {
          return (
            <AuthenticatedImageOverlay
              key={key}
              baseMediaId={block.baseMediaId}
              overlayMediaId={block.overlayMediaId}
              alt={block.alt}
              decorative={block.decorative}
            />
          );
        }
        if (block.type === "audio") {
          return (
            <AuthenticatedMedia
              key={key}
              kind="audio"
              mediaId={block.mediaId}
              label={block.label}
              transcript={block.transcript}
            />
          );
        }
        if (block.type === "video") {
          return (
            <AuthenticatedMedia
              key={key}
              kind="video"
              mediaId={block.mediaId}
              label={block.label}
              captions={block.captions}
            />
          );
        }
        if (block.type === "animation") {
          return (
            <div
              key={key}
              className={`card-animation animation-${block.preset}`}
              style={{ animationDuration: `${block.durationMs}ms` }}
              role="img"
              aria-label={block.label}
            />
          );
        }
        if (block.type === "graphic") {
          return (
            <TrustedGraphic
              key={key}
              graphicId={block.graphicId}
              label={block.label}
            />
          );
        }
        if (block.type === "europeMap" || block.type === "geographyMap") {
          return (
            <EuropeMap
              key={key}
              block={block}
              locale={locale}
              explore={exploreMap}
              securelyRecognizedCardIds={securelyRecognizedCardIds}
              quizTargetRegionCode={mapQuizTargetRegionCode}
              quizRevealed={mapQuizRevealed}
              onQuizRegionSelect={onMapQuizRegionSelect}
            />
          );
        }
        if (block.type === "cloze") {
          return (
            <AnkiClozeContent
              answer={answer}
              block={block}
              key={key}
              locale={locale}
            />
          );
        }
        if (block.type === "richText") {
          return (
            <RichTextContent
              key={`${key}:${shuffleSeed ?? "preview"}`}
              block={block}
              answer={answer}
              shuffleSeed={shuffleSeed}
              onClozeCorrect={(clozeId) =>
                onClozeCorrect?.(`${index}:${clozeId}`)
              }
              onClozeIncorrect={onClozeIncorrect}
              canSpeakChoices={speech.canSpeakChoices}
              speakingText={speech.speakingText}
              onSpeakChoice={(choice) => {
                onClozeHint?.();
                speech.speak(clozeChoiceToSpeechText(choice));
              }}
              trailingContent={
                index === speechAnchorIndex ? speechControl : undefined
              }
              styles={contentStyles}
              contentLocale={locale}
            />
          );
        }
        if (block.type === "markdown") {
          let document;
          try {
            document = markdownToRichTextDocument(block.source);
          } catch (cause) {
            return (
              <p className="card-content-error" key={key} role="alert">
                <strong>
                  {locale === "de"
                    ? "Diese Karte kann nicht angezeigt werden."
                    : "This card cannot be displayed."}
                </strong>{" "}
                {markdownSyntaxMessage(cause, locale)}
              </p>
            );
          }
          return (
            <RichTextContent
              key={`${key}:${shuffleSeed ?? "preview"}`}
              block={{
                type: "richText",
                revealMode: resolveMarkdownClozeRevealMode(
                  block.source,
                  block.revealMode,
                ),
                document,
              }}
              answer={answer}
              shuffleSeed={shuffleSeed}
              onClozeCorrect={(clozeId) =>
                onClozeCorrect?.(`${index}:${clozeId}`)
              }
              onClozeIncorrect={onClozeIncorrect}
              canSpeakChoices={speech.canSpeakChoices}
              speakingText={speech.speakingText}
              onSpeakChoice={(choice) => {
                onClozeHint?.();
                speech.speak(clozeChoiceToSpeechText(choice));
              }}
              trailingContent={
                index === speechAnchorIndex ? speechControl : undefined
              }
              styles={contentStyles}
              contentLocale={locale}
            />
          );
        }
        return (
          <p
            className={[
              "card-text",
              block.marks?.bold ? "bold" : "",
              block.marks?.italic ? "italic" : "",
            ].join(" ")}
            key={key}
          >
            {withSpeechControl(index, block.text)}
          </p>
        );
      })}
      {speechControl && speechAnchorIndex < 0 ? speechControl : null}
    </div>
  );
}
