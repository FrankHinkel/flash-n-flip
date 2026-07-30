"use client";

import { Square, Volume2 } from "lucide-react";
import {
  markdownToRichTextDocument,
  type CardContent,
} from "@flashcards/domain/content";

import {
  AuthenticatedImageOverlay,
  AuthenticatedMedia,
} from "./authenticated-media";
import { EuropeMap } from "./europe-map";
import { RichTextContent } from "./rich-text-content";
import { markdownSyntaxMessage } from "./markdown-errors";
import {
  cardContentToSpeechText,
  clozeChoiceToSpeechText,
} from "./speech-text";
import { visibleStudyContentBlocks } from "./study-content";
import { useTextToSpeech } from "./use-text-to-speech";

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
}) {
  const blocks = visibleStudyContentBlocks(content, skipFirstHeading);
  const speech = useTextToSpeech(locale, speechEnabled);
  const speechText = cardContentToSpeechText(content, answer);
  const speechIsActive = speech.speakingText === speechText;

  return (
    <div className="card-content">
      {speech.canSpeak && speechText ? (
        <button
          type="button"
          className="card-speech-button"
          aria-label={
            speechIsActive
              ? locale === "de"
                ? "Vorlesen stoppen"
                : "Stop reading"
              : answer
                ? locale === "de"
                  ? "Vollständige Antwort vorlesen"
                  : "Read completed answer"
                : locale === "de"
                  ? "Satz mit Lücken vorlesen"
                  : "Read sentence with blanks"
          }
          title={
            answer
              ? locale === "de"
                ? "Vollständige Antwort vorlesen"
                : "Read completed answer"
              : locale === "de"
                ? "Satz mit Sprechpausen vorlesen"
                : "Read sentence with spoken pauses"
          }
          onClick={(event) => {
            event.stopPropagation();
            speech.speak(speechText);
          }}
        >
          {speechIsActive ? (
            <Square aria-hidden="true" size={17} />
          ) : (
            <Volume2 aria-hidden="true" size={19} />
          )}
        </button>
      ) : null}
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2 key={key}>{block.text}</h2>
          ) : (
            <h3 key={key}>{block.text}</h3>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          );
        }
        if (block.type === "formula") {
          return (
            <code className="formula" key={key}>
              {block.latex}
            </code>
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
            <div
              className="trusted-graphic"
              key={key}
              role="img"
              aria-label={block.label}
            >
              {block.label}
            </div>
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
          return <p key={key}>{block.text}</p>;
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
                revealMode: block.revealMode,
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
            />
          );
        }
        return (
          <p
            className={[
              block.marks?.bold ? "bold" : "",
              block.marks?.italic ? "italic" : "",
            ].join(" ")}
            key={key}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
