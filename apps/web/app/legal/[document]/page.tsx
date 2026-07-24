import Link from "next/link";
import { notFound } from "next/navigation";

import { Brand } from "../../../components/brand";

const documents = {
  privacy: {
    title: "Datenschutzerklärung",
    sections: [
      [
        "Wofür gilt diese Erklärung?",
        "Sie gilt für die Flora Apps, die Webanwendung und die öffentliche Community.",
      ],
      [
        "Welche Daten verarbeiten wir?",
        "Kontodaten, private Lerninhalte, Lernfortschritt, Sitzungen, freiwillig hochgeladene Medien sowie technische Sicherheitsprotokolle. Private Lerninhalte werden nicht für Werbung verwendet.",
      ],
      [
        "Warum verarbeiten wir diese Daten?",
        "Um dein Konto, Offline-Synchronisation, Lernplanung, Community-Veröffentlichungen, Moderation und den sicheren Betrieb bereitzustellen.",
      ],
      [
        "Deine Rechte",
        "Du kannst deine Daten in den Einstellungen exportieren und dein Konto löschen. Je nach Rechtslage bestehen außerdem Rechte auf Auskunft, Berichtigung, Einschränkung und Widerspruch.",
      ],
      [
        "Kontakt",
        "Die vollständigen Betreiber- und Datenschutzkontakte werden vor dem öffentlichen Produktivstart ergänzt.",
      ],
    ],
  },
  terms: {
    title: "Nutzungsbedingungen",
    sections: [
      [
        "Dein Konto",
        "Halte deine Zugangsdaten sicher und veröffentliche keine rechtswidrigen oder fremden Inhalte ohne Erlaubnis.",
      ],
      [
        "Community-Inhalte",
        "Jede Veröffentlichung wird geprüft. Eine Freigabe ist keine Garantie fachlicher Vollständigkeit. Quellen und Lizenzen müssen korrekt angegeben werden.",
      ],
      [
        "Moderation",
        "Wir können Änderungen verlangen, Veröffentlichungen sperren oder entfernen. Entscheidungen werden intern nachvollziehbar protokolliert.",
      ],
      [
        "Deine privaten Daten",
        "Deine privaten Lernsets bleiben privat, bis du bewusst eine unveränderliche Revision zur Prüfung einreichst.",
      ],
    ],
  },
  imprint: {
    title: "Impressum",
    sections: [
      [
        "Angaben zum Betreiber",
        "Die rechtsverbindlichen Betreiberangaben, Anschrift und Vertretungsberechtigung werden vor dem öffentlichen Produktivstart eingetragen.",
      ],
      [
        "Kontakt",
        "Ein rechtsverbindlicher Support- und Medienkontakt wird vor Veröffentlichung ergänzt.",
      ],
    ],
  },
} as const;

export default async function LegalPage({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  const content = documents[document as keyof typeof documents];
  if (!content) notFound();
  return (
    <main className="legal-page">
      <nav>
        <Brand />
        <Link href="/">Zur Startseite</Link>
      </nav>
      <article>
        <span className="eyebrow">Stand: 24. Juli 2026</span>
        <h1>{content.title}</h1>
        <p className="legal-notice">
          Entwurf für die Entwicklung – vor dem Produktivstart ist eine
          rechtliche Prüfung erforderlich.
        </p>
        {content.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
