"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { filterHelpTopics, helpTopics } from "./help-content";
import { useI18n } from "./i18n-provider";
import styles from "./online-help.module.css";

export function OnlineHelp() {
  const { locale, text } = useI18n();
  const [query, setQuery] = useState("");
  const topics = useMemo(() => filterHelpTopics(query), [query]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>
          {text("Flash-n-Flip guide", "Flash-n-Flip-Handbuch")}
        </span>
        <h1>{text("How can we help?", "Wie können wir helfen?")}</h1>
        <p>
          {text(
            "Find clear instructions for creating, organizing, importing, and studying your flashcards.",
            "Hier findest du verständliche Anleitungen zum Erstellen, Organisieren, Importieren und Lernen deiner Karteikarten.",
          )}
        </p>
      </header>

      <div className={styles.search} role="search">
        <label htmlFor="help-search">
          {text("Search the help", "Hilfe durchsuchen")}
        </label>
        <div className={styles.searchControl}>
          <Search aria-hidden="true" size={20} />
          <input
            id="help-search"
            type="search"
            value={query}
            autoComplete="off"
            placeholder={text(
              "For example: cloze, import, map …",
              "Zum Beispiel: Lückentext, Import, Karte …",
            )}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className={styles.resultStatus} role="status" aria-live="polite">
          {query.trim()
            ? text(
                `${topics.length} of ${helpTopics.length} topics`,
                `${topics.length} von ${helpTopics.length} Themen`,
              )
            : text(
                `${helpTopics.length} help topics`,
                `${helpTopics.length} Hilfethemen`,
              )}
        </p>
      </div>

      <div className={styles.layout}>
        {topics.length ? (
          <nav
            className={styles.contents}
            aria-label={text("Help topics", "Hilfethemen")}
          >
            <strong>{text("On this page", "Auf dieser Seite")}</strong>
            {topics.map((topic) => (
              <a href={`#${topic.id}`} key={topic.id}>
                {topic.title[locale]}
              </a>
            ))}
          </nav>
        ) : null}

        <div className={styles.topics}>
          {topics.map((topic) => (
            <article className={styles.topic} id={topic.id} key={topic.id}>
              <h2>{topic.title[locale]}</h2>
              <p className={styles.summary}>{topic.summary[locale]}</p>
              {topic.sections.map((section) => (
                <section
                  className={styles.section}
                  key={`${topic.id}-${section.heading.en}`}
                >
                  <h3>{section.heading[locale]}</h3>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph.en}>{paragraph[locale]}</p>
                  ))}
                  {section.steps?.length ? (
                    <ol>
                      {section.steps.map((step) => (
                        <li key={step.en}>{step[locale]}</li>
                      ))}
                    </ol>
                  ) : null}
                  {section.bullets?.length ? (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet.en}>{bullet[locale]}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.code?.length ? (
                    <div
                      className={styles.codeList}
                      aria-label={text("Examples", "Beispiele")}
                    >
                      {section.code.map((example) => (
                        <code key={example}>{example}</code>
                      ))}
                    </div>
                  ) : null}
                  {section.links?.length ? (
                    <ul className={styles.referenceLinks}>
                      {section.links.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {link.label[locale]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </article>
          ))}
          {!topics.length ? (
            <section className={styles.empty}>
              <h2>{text("No help topic found", "Kein Hilfethema gefunden")}</h2>
              <p>
                {text(
                  "Try a shorter or more general search term.",
                  "Versuche einen kürzeren oder allgemeineren Suchbegriff.",
                )}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
