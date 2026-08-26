"use client";

import Link from "next/link";

import type { Locale } from "@flashcards/i18n";

import { Brand } from "./brand";
import { useI18n } from "./i18n-provider";

type LegalDocumentName = "privacy" | "terms" | "imprint";
type LocalizedText = [english: string, german: string];

type LegalDocumentCopy = {
  title: LocalizedText;
  sections: Array<{
    heading: LocalizedText;
    paragraphs: LocalizedText[];
  }>;
};

const operator: LocalizedText = [
  "Frank Hinkel\nFriedenstr. 39\n67292 Kirchheimbolanden\nGermany",
  "Frank Hinkel\nFriedenstr. 39\n67292 Kirchheimbolanden\nDeutschland",
];

const contact: LocalizedText = [
  "Phone: +49 6353 749953\nEmail: flash-n-flip@hi-sys.de",
  "Telefon: +49 6353 749953\nE-Mail: flash-n-flip@hi-sys.de",
];

const documents: Record<LegalDocumentName, LegalDocumentCopy> = {
  privacy: {
    title: ["Privacy information", "Datenschutzhinweise"],
    sections: [
      {
        heading: ["Controller", "Verantwortlicher"],
        paragraphs: [operator, contact],
      },
      {
        heading: ["Current product scope", "Aktueller Produktumfang"],
        paragraphs: [
          [
            "Flash-n-Flip V1 starts as an Apple-only product and has no Flash-n-Flip account on the VPS. Private decks, cards, settings, media and learning progress remain in installed-app SQLite and local media storage. The Apple app does not use flash-n-flip.com, rendezvous, STUN or WebRTC for application startup or synchronization.",
            "Flash-n-Flip V1 startet als Apple-only-Produkt und besitzt kein Flash-n-Flip-Konto auf dem VPS. Private Lernsets, Karten, Einstellungen, Medien und Lernfortschritte bleiben in App-SQLite und lokalem Medienspeicher. Die Apple-App nutzt flash-n-flip.com, Rendezvous, STUN oder WebRTC weder zum App-Start noch zur Synchronisation.",
          ],
          [
            "The Web/PWA and Connect implementation is parked outside the Apple V1 product. Existing test services may remain temporarily available for older test builds until a documented retirement, but the Apple V1 bundle neither contains nor calls them. Curated starter content and help are bundled locally.",
            "Die Web/PWA- und Connect-Implementierung ist außerhalb des Apple-V1-Produkts geparkt. Bestehende Testdienste können für ältere Test-Builds bis zu einer dokumentierten Stilllegung vorübergehend erreichbar bleiben; das Apple-V1-Bundle enthält und verwendet sie jedoch nicht. Kuratierte Startinhalte und Hilfe sind lokal gebündelt.",
          ],
        ],
      },
      {
        heading: ["Storage on the device", "Speicherung auf dem Gerät"],
        paragraphs: [
          [
            "Local storage is technically required for the offline editor, study progress, restart recovery and FNF export and restore. The Apple V1 product flow uses no optional analytics, advertising or tracking storage.",
            "Die lokale Speicherung ist für den Offline-Editor, Lernfortschritt, die Wiederherstellung nach einem Neustart sowie FNF-Export und -Restore technisch erforderlich. Der Apple-V1-Produktfluss verwendet keine optionalen Analyse-, Werbe- oder Tracking-Speicherungen.",
          ],
          [
            "Users can delete decks, create a complete local export or remove app and website data through the operating system. The operator cannot access content stored only on the device.",
            "Nutzer können Lernsets löschen, einen vollständigen lokalen Export erstellen oder App- und Website-Daten über das Betriebssystem entfernen. Auf ausschließlich lokal gespeicherte Inhalte hat der Betreiber keinen Zugriff.",
          ],
        ],
      },
      {
        heading: ["Parked test services", "Geparkte Testdienste"],
        paragraphs: [
          [
            "Older test builds may still reach the parked Connect service during the retirement window. It keeps random session metadata and encrypted WebRTC signals in memory for at most five minutes. The Apple V1 application does not invoke this service.",
            "Ältere Test-Builds können den geparkten Connect-Dienst während des Stilllegungsfensters noch erreichen. Er hält zufällige Sitzungsmetadaten und verschlüsselte WebRTC-Signale höchstens fünf Minuten im Arbeitsspeicher. Die Apple-V1-App ruft diesen Dienst nicht auf.",
          ],
          [
            "The Apple V1 application provides no WebRTC device transfer. Until iCloud is released, users move and recover their data explicitly through an FNF backup under their own control.",
            "Die Apple-V1-App bietet keine WebRTC-Geräteübertragung. Bis zur Einführung von iCloud übertragen und sichern Nutzer ihre Daten ausdrücklich über eine selbst kontrollierte FNF-Sicherung.",
          ],
        ],
      },
      {
        heading: ["Hosting and recipients", "Hosting und Empfänger"],
        paragraphs: [
          [
            "The Web, rendezvous and STUN infrastructure is hosted by netcup GmbH, Emmy-Noether-Straße 10, 76131 Karlsruhe, Germany. The server location is Nuremberg, Germany. The current data-processing agreement with netcup still needs to be confirmed before public production launch.",
            "Die Web-, Rendezvous- und STUN-Infrastruktur wird bei der netcup GmbH, Emmy-Noether-Straße 10, 76131 Karlsruhe, Deutschland, betrieben. Serverstandort ist Nürnberg, Deutschland. Der aktuelle Vertrag zur Auftragsverarbeitung mit netcup muss vor dem öffentlichen Produktivstart noch bestätigt werden.",
          ],
          [
            "Directly paired devices are recipients selected by the user. Flash-n-Flip does not receive the private content transferred between them. No transfer of active VPS data to a third country is intended.",
            "Direkt gekoppelte Geräte sind vom Nutzer ausgewählte Empfänger. Flash-n-Flip erhält die zwischen ihnen übertragenen privaten Inhalte nicht. Eine Übertragung aktiver VPS-Daten in ein Drittland ist nicht vorgesehen.",
          ],
        ],
      },
      {
        heading: ["Purposes and legal bases", "Zwecke und Rechtsgrundlagen"],
        paragraphs: [
          [
            "Connection and rendezvous data is processed to provide the service explicitly requested by the user. Technical operational data is processed to deliver, stabilize and secure the service and to diagnose faults and prevent abuse. The final legal classification and legitimate-interest assessment require qualified review before public launch.",
            "Verbindungs- und Rendezvous-Daten werden verarbeitet, um den ausdrücklich angeforderten Dienst bereitzustellen. Technische Betriebsdaten dienen Auslieferung, Stabilität, Sicherheit, Fehlerdiagnose und Missbrauchsabwehr. Die abschließende Rechtsgrundlagenzuordnung und Interessenabwägung muss vor dem öffentlichen Start qualifiziert geprüft werden.",
          ],
          [
            "Storage required to provide the digital service expressly requested by the user does not require consent under the applicable device-storage exception. Optional storage would require a separate legal basis or consent and is not active in the current product flow.",
            "Eine für den ausdrücklich gewünschten digitalen Dienst unbedingt erforderliche Speicherung benötigt nach der einschlägigen Endgeräte-Ausnahme keine Einwilligung. Optionale Speicherungen würden eine gesonderte Rechtsgrundlage oder Einwilligung benötigen und sind im aktuellen Produktfluss nicht aktiv.",
          ],
        ],
      },
      {
        heading: [
          "Operational logs and retention",
          "Betriebslogs und Aufbewahrung",
        ],
        paragraphs: [
          [
            "Fastify, Coturn, Docker and the host system can create operational and security logs containing IP address and port, time, route, status, duration and request ID. The real fields, access controls, rotation and maximum retention period still need to be verified and technically limited on the running VPS. Public production launch remains blocked until that is complete.",
            "Fastify, Coturn, Docker und das Hostsystem können Betriebs- und Sicherheitslogs mit IP-Adresse und Port, Zeitpunkt, Route, Status, Laufzeit und Request-ID erzeugen. Reale Felder, Zugriffsrechte, Rotation und maximale Aufbewahrungsdauer müssen auf dem laufenden VPS noch geprüft und technisch begrenzt werden. Bis dahin bleibt der öffentliche Produktivstart gesperrt.",
          ],
          [
            "The five-minute rendezvous lifetime is not a promise that operational logs are also deleted after five minutes. Inactive legacy databases, uploads and backups also require a verified migration end, deletion trigger and backup expiry period.",
            "Die fünfminütige Rendezvous-Laufzeit ist keine Zusage, dass Betriebslogs ebenfalls nach fünf Minuten gelöscht werden. Auch inaktive Altdatenbanken, Uploads und Backups benötigen einen geprüften Migrationsabschluss, Löschtrigger und eine Backup-Auslauffrist.",
          ],
        ],
      },
      {
        heading: ["Apple services", "Apple-Dienste"],
        paragraphs: [
          [
            "iCloud backup, iCloud Keychain bootstrap and CloudKit family sharing are disabled in the current Personal Team build. This build requests no iCloud entitlement and transfers no app data to CloudKit. The App Store privacy information and EU DSA trader status must be finalized before distribution in the EU.",
            "iCloud-Backup, iCloud-Schlüsselbund-Bootstrap und CloudKit-Familienfreigabe sind im aktuellen Personal-Team-Build deaktiviert. Dieser Build fordert keine iCloud-Berechtigung an und überträgt keine App-Daten an CloudKit. App-Store-Datenschutzangaben und EU-DSA-Trader-Status müssen vor einer EU-Veröffentlichung finalisiert werden.",
          ],
        ],
      },
      {
        heading: ["Your rights", "Deine Rechte"],
        paragraphs: [
          [
            "Where the operator processes personal data, legal requirements may provide rights of access, rectification, erasure, restriction, portability and objection. Requests can be sent to flash-n-flip@hi-sys.de. Data stored only on a device cannot be identified, viewed or changed by the operator and remains under the user's local control.",
            "Soweit der Betreiber personenbezogene Daten verarbeitet, bestehen nach den gesetzlichen Voraussetzungen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Anfragen können an flash-n-flip@hi-sys.de gerichtet werden. Ausschließlich lokal gespeicherte Daten kann der Betreiber nicht identifizieren, einsehen oder ändern; sie bleiben unter lokaler Kontrolle des Nutzers.",
          ],
          [
            "You can complain to a data protection authority. The authority expected to be competent for the controller is the State Commissioner for Data Protection and Freedom of Information Rhineland-Palatinate, Hintere Bleiche 34, 55116 Mainz, Germany, poststelle@datenschutz.rlp.de, datenschutz.rlp.de.",
            "Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren. Für den Verantwortlichen ist voraussichtlich der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz, Hintere Bleiche 34, 55116 Mainz, poststelle@datenschutz.rlp.de, datenschutz.rlp.de zuständig.",
          ],
        ],
      },
      {
        heading: ["Children", "Minderjährige"],
        paragraphs: [
          [
            "Flash-n-Flip is a learning app and may be used by children. Its current accountless flow keeps private learning content local and has no personalized advertising, public publishing or profiling. A final age, parental-guidance and store-rating policy remains required before public launch.",
            "Flash-n-Flip ist eine Lernanwendung und kann von Minderjährigen verwendet werden. Der aktuelle kontolose Fluss hält private Lerninhalte lokal und enthält keine personalisierte Werbung, öffentliche Veröffentlichung oder Profilbildung. Eine abschließende Alters-, Eltern- und Store-Einstufung bleibt vor dem öffentlichen Start erforderlich.",
          ],
        ],
      },
    ],
  },
  terms: {
    title: ["Terms of use", "Nutzungsbedingungen"],
    sections: [
      {
        heading: ["Provider", "Anbieter"],
        paragraphs: [operator, contact],
      },
      {
        heading: ["Current service", "Aktueller Leistungsumfang"],
        paragraphs: [
          [
            "Flash-n-Flip is a local learning application. The current public server delivers the PWA and curated collections and provides short-lived rendezvous for explicitly initiated device pairing. It has no user accounts, private cloud backup, community hosting, advertising, analytics, payments or subscriptions.",
            "Flash-n-Flip ist eine lokale Lernanwendung. Der aktuelle öffentliche Server liefert PWA und kuratierte Sammlungen und vermittelt kurzfristig ausdrücklich gestartete Gerätekopplungen. Er betreibt keine Benutzerkonten, privaten Cloudbackups, Community, Werbung, Analytik, Zahlungen oder Abonnements.",
          ],
          [
            "Permanent availability is not guaranteed. Local data is not backed up solely by the operator; users should create regular complete local exports.",
            "Eine dauerhafte Verfügbarkeit wird nicht zugesichert. Lokale Daten werden nicht allein durch den Betreiber gesichert; Nutzer sollen regelmäßig vollständige lokale Exporte erstellen.",
          ],
        ],
      },
      {
        heading: ["Your content and imports", "Eigene Inhalte und Importe"],
        paragraphs: [
          [
            "Users are responsible for having the necessary rights to import, edit and directly transfer learning content and media. Unlawful content or third-party content without the required permission must not be used or shared. Importing content does not publish it; public community submission is not part of the active product.",
            "Nutzer sind dafür verantwortlich, die erforderlichen Rechte für Import, Bearbeitung und direkte Übertragung von Lerninhalten und Medien zu besitzen. Rechtswidrige Inhalte oder fremde Inhalte ohne erforderliche Erlaubnis dürfen nicht verwendet oder geteilt werden. Ein Import veröffentlicht Inhalte nicht; eine öffentliche Community-Einreichung ist nicht Teil des aktiven Produkts.",
          ],
        ],
      },
      {
        heading: ["Direct device pairing", "Direkte Gerätekopplung"],
        paragraphs: [
          [
            "Pairing codes and invitation links should only be shared with trusted people and devices. The operator cannot recover directly transferred content or reverse a completed transfer.",
            "Kopplungscodes und Einladungslinks sollen nur mit vertrauten Personen und Geräten geteilt werden. Der Betreiber kann direkt übertragene Inhalte weder wiederherstellen noch eine abgeschlossene Übertragung rückgängig machen.",
          ],
        ],
      },
      {
        heading: ["Curated content", "Kuratierte Inhalte"],
        paragraphs: [
          [
            "Curated collections are versioned and signed. Errors or outdated information cannot be completely excluded. Learning content does not replace professional medical, legal, financial or other specialist advice. Source and license notices remain part of each collection.",
            "Kuratierte Sammlungen sind versioniert und signiert. Fehler oder veraltete Angaben können nicht vollständig ausgeschlossen werden. Lerninhalte ersetzen keine professionelle medizinische, rechtliche, finanzielle oder sonstige Fachberatung. Quellen- und Lizenzangaben bleiben Bestandteil der jeweiligen Sammlung.",
          ],
        ],
      },
      {
        heading: ["Local data control", "Lokale Datenkontrolle"],
        paragraphs: [
          [
            "Deleting an app or browser data can cause irreversible local data loss unless a local export or peer backup exists. Users can delete decks, remove app and website data and create a complete local export.",
            "Das Löschen einer App oder von Browserdaten kann ohne lokalen Export oder Peer-Backup zu unwiederbringlichem Datenverlust führen. Nutzer können Lernsets löschen, App- und Website-Daten entfernen und einen vollständigen lokalen Export erstellen.",
          ],
        ],
      },
      {
        heading: ["Permitted use", "Zulässige Nutzung"],
        paragraphs: [
          [
            "Attacks, circumvention of technical safeguards, automated overload and unlawful use or distribution of content are prohibited.",
            "Angriffe, Umgehung technischer Schutzmaßnahmen, automatisierte Überlastung und rechtswidrige Nutzung oder Verbreitung von Inhalten sind untersagt.",
          ],
        ],
      },
      {
        heading: ["Open legal decisions", "Offene rechtliche Festlegungen"],
        paragraphs: [
          [
            "The business and tax classification, final liability provisions, consumer information, policy for children and possible consumer-dispute information require qualified legal review before public production launch. This draft is not the final public contractual version.",
            "Geschäftliche und steuerliche Einordnung, abschließende Haftungsregeln, Verbraucherinformationen, Minderjährigenregelung und mögliche Verbraucherstreitinformationen erfordern vor dem öffentlichen Produktivstart eine qualifizierte rechtliche Prüfung. Dieser Entwurf ist noch keine endgültige öffentliche Vertragsfassung.",
          ],
        ],
      },
    ],
  },
  imprint: {
    title: ["Imprint", "Impressum"],
    sections: [
      {
        heading: ["Service provider", "Diensteanbieter"],
        paragraphs: [operator],
      },
      {
        heading: ["Contact", "Kontakt"],
        paragraphs: [contact],
      },
      {
        heading: ["Legal status", "Rechtlicher Status"],
        paragraphs: [
          [
            "Flash-n-Flip is currently operated by Frank Hinkel as a natural person. There is no UG or GmbH. A possible business classification and any VAT or business identification numbers that may need to be disclosed remain to be confirmed before public production launch.",
            "Flash-n-Flip wird derzeit von Frank Hinkel als natürlicher Person betrieben. Es besteht keine UG oder GmbH. Eine mögliche gewerbliche Einordnung sowie gegebenenfalls anzugebende Umsatzsteuer- oder Wirtschafts-Identifikationsnummern müssen vor dem öffentlichen Produktivstart bestätigt werden.",
          ],
        ],
      },
    ],
  },
};

const documentLinks: Array<{
  name: LegalDocumentName;
  href: string;
  label: LocalizedText;
}> = [
  {
    name: "imprint",
    href: "/legal/imprint",
    label: ["Imprint", "Impressum"],
  },
  {
    name: "privacy",
    href: "/legal/privacy",
    label: ["Privacy", "Datenschutz"],
  },
  {
    name: "terms",
    href: "/legal/terms",
    label: ["Terms", "Nutzungsbedingungen"],
  },
];

// Legal copy is deliberately maintained as reviewed EN/DE source text. ES/FR
// use the reviewed English version until qualified translations are approved.
const legalText = (locale: Locale, value: LocalizedText): string =>
  locale === "de" ? value[1] : value[0];

export function LegalDocument({ document }: { document: LegalDocumentName }) {
  const { locale, text } = useI18n();
  const content = documents[document];

  return (
    <main className="legal-page">
      <nav>
        <Brand />
        <Link href="/">{text("legacy.af77d1d73c80")}</Link>
      </nav>
      <article>
        <span className="eyebrow">{text("legacy.c4fd63779744")}</span>
        <h1>{legalText(locale, content.title)}</h1>
        <p className="legal-notice">{text("legacy.f5ba6578cdec")}</p>
        {content.sections.map(({ heading, paragraphs }) => (
          <section key={heading[0]}>
            <h2>{legalText(locale, heading)}</h2>
            {paragraphs.map((paragraph) => (
              <p key={paragraph[0]}>{legalText(locale, paragraph)}</p>
            ))}
          </section>
        ))}
        <nav
          aria-label={text("legacy.d8b1f2729b74")}
          className="legal-document-links"
        >
          {documentLinks.map(({ name, href, label }) => (
            <Link
              aria-current={name === document ? "page" : undefined}
              href={href}
              key={name}
            >
              {legalText(locale, label)}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
