import type { CardContent } from "@flashcards/domain/content";

import { AuthenticatedMedia } from "./authenticated-media";
import { EuropeMap } from "./europe-map";

export function ContentView({
  content,
  locale = "en",
  onNavigateCard,
  securelyRecognizedCardIds,
}: {
  content: CardContent;
  locale?: string;
  onNavigateCard?: (cardId: string) => void;
  securelyRecognizedCardIds?: readonly string[];
}) {
  return (
    <div className="card-content">
      {content.blocks.map((block, index) => {
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
        if (block.type === "europeMap") {
          return (
            <EuropeMap
              key={key}
              block={block}
              locale={locale}
              onNavigateCard={onNavigateCard}
              securelyRecognizedCardIds={securelyRecognizedCardIds}
            />
          );
        }
        if (block.type === "cloze") {
          return <p key={key}>{block.text}</p>;
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
