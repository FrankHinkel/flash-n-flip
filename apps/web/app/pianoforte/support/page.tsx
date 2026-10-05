import type { Metadata } from "next";
import Link from "next/link";

import styles from "../pianoforte.module.css";

export const metadata: Metadata = {
  title: { absolute: "Pianoforte support" },
  description:
    "Contact and help for the Pianoforte piano-practice app on iPhone and iPad.",
  alternates: { canonical: "/pianoforte/support" },
};

export default function PianoforteSupportPage() {
  return (
    <main id="main" className={styles.document}>
      <p className={styles.eyebrow}>Pianoforte · Support</p>
      <h1>Help with your practice</h1>
      <p className={styles.documentLead}>
        Pianoforte is a free piano-practice app for iPhone and iPad. It works
        without a Pianoforte account and without MIDI hardware.
      </p>
      <section lang="en" aria-labelledby="support-en">
        <h2 id="support-en">English</h2>
        <h3>Contact</h3>
        <p>
          Email <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>
          . The provider is Frank Hinkel, Friedenstraße 39, D-67292
          Kirchheimbolanden, Germany.
        </p>
        <h3>Help inside the app</h3>
        <p>
          Open settings with the piano icon, then tap the question mark at the
          top left. The help explains practice modes, controls, keyboard pan and
          zoom, changing a note's hand, Learn settings, PDF printing and MIDI
          connections. Opening help from Learn, Print or MIDI expands the
          relevant chapter. A MIDI keyboard is recommended; touch practice
          remains useful when travelling.
        </p>
        <h3>What helps us investigate</h3>
        <p>
          Please include the Pianoforte and iOS/iPadOS versions, device model
          and steps to reproduce the problem. For score imports, tell us the
          file format. For MIDI issues, include the piano model and whether the
          connection is USB or Bluetooth. For iCloud issues, describe the
          affected devices and what happened before the problem appeared.
        </p>
        <p>
          Never send your Apple password. Only send a score file if you have the
          right to share it and it is needed to diagnose the issue. Support
          emails are deleted when the request is resolved, unless a legal
          obligation requires retention.
        </p>
        <p>Support replies as soon as practicable.</p>
      </section>
      <section lang="de" aria-labelledby="support-de">
        <h2 id="support-de">Deutsch</h2>
        <h3>Kontakt</h3>
        <p>
          E-Mail:{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
          Anbieter: Frank Hinkel, Friedenstraße 39, D-67292 Kirchheimbolanden,
          Deutschland.
        </p>
        <h3>Hilfe in der App</h3>
        <p>
          Öffne die Einstellungen über das Piano-Symbol und tippe oben links auf
          das Fragezeichen. Die Hilfe erklärt Arbeitsmodi, Bedienelemente,
          Verschieben und Zoomen der Klaviatur, den Handwechsel bei Noten,
          Learn-Einstellungen, PDF-Druck und MIDI-Verbindungen. Aus Learn, Print
          oder MIDI öffnet sich das passende Kapitel. Ein MIDI-Keyboard wird
          empfohlen; unterwegs kannst du dich über Touch mit einem Stück
          vertraut machen.
        </p>
        <h3>Hilfreiche Angaben zur Fehlersuche</h3>
        <p>
          Bitte Pianoforte- und iOS-/iPadOS-Version, Gerätemodell und Schritte
          zum Nachstellen angeben. Bei Importproblemen hilft das Dateiformat;
          bei MIDI-Problemen das Klaviermodell und die Angabe USB oder
          Bluetooth. Bei iCloud-Problemen bitte betroffene Geräte und den Ablauf
          vor dem Fehler beschreiben.
        </p>
        <p>
          Niemals das Apple-Passwort senden. Eine Notendatei bitte nur
          weitergeben, wenn das erlaubt und für die Fehlersuche erforderlich
          ist. Support-E-Mails werden nach Abschluss der Anfrage gelöscht,
          sofern keine gesetzliche Pflicht zur längeren Aufbewahrung besteht.
        </p>
        <p>Support antwortet so bald wie möglich.</p>
      </section>
      <div className={styles.supportEnd}>
        <Link href="/pianoforte/privacy">Read the privacy policy →</Link>
      </div>
    </main>
  );
}
