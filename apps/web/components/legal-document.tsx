"use client";

import Link from "next/link";

import { Brand } from "./brand";
import { useI18n } from "./i18n-provider";

type LegalDocumentName = "privacy" | "terms" | "imprint";

type LegalDocumentCopy = {
  title: [english: string, german: string];
  sections: Array<
    [
      headingEnglish: string,
      headingGerman: string,
      bodyEnglish: string,
      bodyGerman: string,
    ]
  >;
};

const documents: Record<LegalDocumentName, LegalDocumentCopy> = {
  privacy: {
    title: ["Privacy policy", "Datenschutzerklärung"],
    sections: [
      [
        "Scope",
        "Wofür gilt diese Erklärung?",
        "This policy applies to the Flash & Flip mobile apps, web application, and public community at flash-n-flip.com.",
        "Diese Erklärung gilt für die mobilen Flash & Flip-Apps, die Webanwendung und die öffentliche Community unter flash-n-flip.com.",
      ],
      [
        "Data we process",
        "Welche Daten verarbeiten wir?",
        "We process account data, private learning content, learning progress, sessions, voluntarily uploaded media, and technical security logs. Private learning content is not used for advertising.",
        "Wir verarbeiten Kontodaten, private Lerninhalte, Lernfortschritt, Sitzungen, freiwillig hochgeladene Medien sowie technische Sicherheitsprotokolle. Private Lerninhalte werden nicht für Werbung verwendet.",
      ],
      [
        "Purposes",
        "Warum verarbeiten wir diese Daten?",
        "We use this data to provide your account, offline synchronization, learning schedules, community publications, moderation, and secure operation.",
        "Wir verwenden diese Daten, um dein Konto, Offline-Synchronisation, Lernplanung, Community-Veröffentlichungen, Moderation und den sicheren Betrieb bereitzustellen.",
      ],
      [
        "Device storage",
        "Speicher auf deinem Gerät",
        "Flash & Flip stores the selected language, sign-in tokens, offline cards, and pending reviews on your device where technically necessary. You can remove account-related local data by signing out.",
        "Flash & Flip speichert die gewählte Sprache, Anmeldetoken, Offline-Karten und ausstehende Wiederholungen technisch notwendig auf deinem Gerät. Kontobezogene lokale Daten kannst du durch Abmelden entfernen.",
      ],
      [
        "Your rights",
        "Deine Rechte",
        "You can export your data and delete your account in Settings. Depending on applicable law, you may also have rights of access, rectification, restriction, and objection.",
        "Du kannst deine Daten in den Einstellungen exportieren und dein Konto löschen. Je nach anwendbarem Recht bestehen außerdem Rechte auf Auskunft, Berichtigung, Einschränkung und Widerspruch.",
      ],
      [
        "Contact",
        "Kontakt",
        "Complete operator and privacy contact details will be added before a public production launch.",
        "Die vollständigen Betreiber- und Datenschutzkontakte werden vor dem öffentlichen Produktivstart ergänzt.",
      ],
    ],
  },
  terms: {
    title: ["Terms of use", "Nutzungsbedingungen"],
    sections: [
      [
        "Your account",
        "Dein Konto",
        "Keep your credentials secure and do not publish unlawful content or third-party content without permission.",
        "Halte deine Zugangsdaten sicher und veröffentliche keine rechtswidrigen oder fremden Inhalte ohne Erlaubnis.",
      ],
      [
        "Community content",
        "Community-Inhalte",
        "Every publication is reviewed. Approval does not guarantee subject-matter completeness. Sources and licenses must be stated correctly.",
        "Jede Veröffentlichung wird geprüft. Eine Freigabe ist keine Garantie fachlicher Vollständigkeit. Quellen und Lizenzen müssen korrekt angegeben werden.",
      ],
      [
        "Moderation",
        "Moderation",
        "We may request changes and suspend or remove publications. Decisions are recorded internally for accountability.",
        "Wir können Änderungen verlangen, Veröffentlichungen sperren oder entfernen. Entscheidungen werden intern nachvollziehbar protokolliert.",
      ],
      [
        "Your private data",
        "Deine privaten Daten",
        "Your private decks remain private until you deliberately submit an immutable revision for review.",
        "Deine privaten Lernsets bleiben privat, bis du bewusst eine unveränderliche Revision zur Prüfung einreichst.",
      ],
    ],
  },
  imprint: {
    title: ["Imprint", "Impressum"],
    sections: [
      [
        "Operator details",
        "Angaben zum Betreiber",
        "Legally binding operator details, address, and authorized representation will be added before a public production launch.",
        "Die rechtsverbindlichen Betreiberangaben, Anschrift und Vertretungsberechtigung werden vor dem öffentlichen Produktivstart eingetragen.",
      ],
      [
        "Contact",
        "Kontakt",
        "A legally binding support and media contact will be added before publication.",
        "Ein rechtsverbindlicher Support- und Medienkontakt wird vor Veröffentlichung ergänzt.",
      ],
    ],
  },
};

export function LegalDocument({ document }: { document: LegalDocumentName }) {
  const { text } = useI18n();
  const content = documents[document];

  return (
    <main className="legal-page">
      <nav>
        <Brand />
        <Link href="/">{text("Back to home", "Zur Startseite")}</Link>
      </nav>
      <article>
        <span className="eyebrow">
          {text("Updated: July 25, 2026", "Stand: 25. Juli 2026")}
        </span>
        <h1>{text(...content.title)}</h1>
        <p className="legal-notice">
          {text(
            "Development draft – legal review is required before production launch.",
            "Entwurf für die Entwicklung – vor dem Produktivstart ist eine rechtliche Prüfung erforderlich.",
          )}
        </p>
        {content.sections.map(
          ([headingEnglish, headingGerman, bodyEnglish, bodyGerman]) => (
            <section key={headingEnglish}>
              <h2>{text(headingEnglish, headingGerman)}</h2>
              <p>{text(bodyEnglish, bodyGerman)}</p>
            </section>
          ),
        )}
      </article>
    </main>
  );
}
