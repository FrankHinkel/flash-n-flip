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
        <span className={styles.eyebrow}>{text("legacy.366787b22ed8")}</span>
        <h1>{text("legacy.5633db102f05")}</h1>
        <p>{text("legacy.0ab008addabd")}</p>
      </header>

      <div className={styles.search} role="search">
        <label htmlFor="help-search">{text("legacy.b9e793305720")}</label>
        <div className={styles.searchControl}>
          <Search aria-hidden="true" size={20} />
          <input
            id="help-search"
            type="search"
            value={query}
            autoComplete="off"
            placeholder={text("legacy.135829272fd7")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className={styles.resultStatus} role="status" aria-live="polite">
          {query.trim()
            ? text("legacy.9e83fc305683", [topics.length, helpTopics.length])
            : text("legacy.18dfac193f72", [helpTopics.length])}
        </p>
      </div>

      <div className={styles.layout}>
        {topics.length ? (
          <nav
            className={styles.contents}
            aria-label={text("legacy.7d3e5ac6637f")}
          >
            <strong>{text("legacy.3c5ac893d52f")}</strong>
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
                      aria-label={text("legacy.564a3b6545c6")}
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
              <h2>{text("legacy.a5ad1b64cb61")}</h2>
              <p>{text("legacy.ee13a9bd9884")}</p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
