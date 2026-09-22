import type { Metadata } from "next";

import styles from "../pianoforte.module.css";

export const metadata: Metadata = {
  title: "Pianoforte privacy policy",
  description:
    "How the Pianoforte piano-practice app handles local data, optional iCloud storage and support requests.",
  alternates: { canonical: "/pianoforte/privacy" },
};

export default function PianofortePrivacyPage() {
  return (
    <main id="main" className={styles.document}>
      <p className={styles.eyebrow}>Pianoforte · Privacy</p>
      <h1>
        Privacy policy <span lang="de">/ Datenschutzerklärung</span>
      </h1>
      <p className={styles.documentLead}>
        Last updated: 22 September 2026 · Stand: 22. September 2026
      </p>

      <section lang="en" aria-labelledby="privacy-en">
        <h2 id="privacy-en">English</h2>
        <h3>Controller and contact</h3>
        <p>
          Pianoforte is provided by Frank Hinkel, Friedenstraße 39, D-67292
          Kirchheimbolanden, Germany. For privacy questions, email{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
        </p>
        <h3>Data on your device</h3>
        <p>
          Pianoforte stores imported score files, musical metadata, favourites,
          library organisation, practice preferences, MIDI settings and
          PDF-export preferences locally. These remain on the device until you
          delete them, reset the app or remove the app. Pianoforte does not
          require an account and has no advertising, tracking or analytics SDK.
        </p>
        <h3>Optional private iCloud storage</h3>
        <p>
          If you choose to store imported scores in iCloud, the original file, a
          source identifier, file name, title, composer, format, difficulty,
          colour, library organisation and deletion state are stored in your
          private Apple CloudKit database. Pianoforte does not operate a
          separate cloud server or make your scores public. Apple provides the
          iCloud service under your Apple account and its terms.
        </p>
        <p>
          Deleting a cloud score removes its file and readable metadata. A
          minimal source identifier and deletion time may remain as a sync
          marker so another device does not restore it. Removing the app deletes
          its local data but does not itself delete your private iCloud data;
          use the Library’s cloud-delete action to remove cloud scores.
        </p>
        <h3>MIDI and support</h3>
        <p>
          USB and Bluetooth MIDI are optional. Connected-device information and
          note events are processed on your device for practice and playback.
          Pianoforte does not upload MIDI performances or audio recordings. The
          app remains usable without MIDI hardware or Bluetooth permission.
        </p>
        <p>
          When you contact support, Frank Hinkel uses your message, contact
          details and any diagnostic information you choose to send only to
          answer the request. Support emails are deleted when the request is
          resolved, unless a legal obligation requires retention. Please do not
          send passwords or music files you have no right to share.
        </p>
        <h3>Your choices and rights</h3>
        <p>
          You can delete local and cloud scores separately in the Library. You
          may also contact{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a> to
          request access, correction or deletion of information held by support,
          or to exercise other rights that apply under data-protection law. You
          may complain to your competent data-protection authority. Pianoforte
          cannot access scores stored only on your device.
        </p>
      </section>

      <section lang="de" aria-labelledby="privacy-de">
        <h2 id="privacy-de">Deutsch</h2>
        <h3>Verantwortlicher und Kontakt</h3>
        <p>
          Pianoforte wird von Frank Hinkel, Friedenstraße 39, D-67292
          Kirchheimbolanden, Deutschland, angeboten. Datenschutzfragen bitte an{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>{" "}
          senden.
        </p>
        <h3>Daten auf dem Gerät</h3>
        <p>
          Pianoforte speichert importierte Notendateien, musikalische Metadaten,
          Favoriten, Bibliotheksorganisation, Übungseinstellungen,
          MIDI-Einstellungen und PDF-Exportvorgaben lokal. Sie bleiben dort, bis
          sie gelöscht, die App zurückgesetzt oder entfernt wird. Pianoforte
          benötigt kein Konto und enthält weder Werbung noch Tracking- oder
          Analyse-SDKs.
        </p>
        <h3>Optionale private iCloud-Ablage</h3>
        <p>
          Wenn du importierte Noten in iCloud speicherst, werden Originaldatei,
          Quellkennung, Dateiname, Titel, Komponist, Format, Schwierigkeit,
          Farbe, Bibliotheksorganisation und Löschstatus in deiner privaten
          Apple-CloudKit-Datenbank gespeichert. Pianoforte betreibt keinen
          eigenen Cloud-Server und veröffentlicht deine Noten nicht. Apple
          stellt iCloud über dein Apple-Konto und nach seinen Bedingungen
          bereit.
        </p>
        <p>
          Beim Löschen eines Cloud-Stücks werden Datei und lesbare Metadaten
          entfernt. Eine minimale Quellkennung und der Löschzeitpunkt können als
          Synchronisationsmarker verbleiben, damit ein anderes Gerät das Stück
          nicht wiederherstellt. Das Entfernen der App löscht lokale Daten,
          nicht automatisch private iCloud-Daten; Cloud-Stücke können in der
          Bibliothek gesondert gelöscht werden.
        </p>
        <h3>MIDI und Support</h3>
        <p>
          USB- und Bluetooth-MIDI sind optional. Geräteinformationen und
          Notenereignisse werden für Übung und Wiedergabe auf dem Gerät
          verarbeitet. Pianoforte lädt weder MIDI-Darbietungen noch
          Audioaufnahmen hoch. Die App funktioniert auch ohne MIDI-Hardware oder
          Bluetooth-Erlaubnis.
        </p>
        <p>
          Bei Supportanfragen verwendet Frank Hinkel deine Nachricht,
          Kontaktdaten und freiwillig mitgesendete Diagnoseinformationen
          ausschließlich zur Bearbeitung. Support-E-Mails werden nach Abschluss
          der Anfrage gelöscht, sofern keine gesetzliche Pflicht zur längeren
          Aufbewahrung besteht. Bitte keine Passwörter oder Notendateien ohne
          Weitergaberecht senden.
        </p>
        <h3>Entscheidungen und Rechte</h3>
        <p>
          Lokale und Cloud-Stücke können in der Bibliothek getrennt gelöscht
          werden. Für Auskunft, Berichtigung oder Löschung von beim Support
          vorhandenen Informationen sowie weitere anwendbare Datenschutzrechte
          kannst du dich an{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>{" "}
          wenden. Beschwerden sind bei der zuständigen Datenschutzaufsicht
          möglich. Auf ausschließlich lokal gespeicherte Noten kann Pianoforte
          nicht zugreifen.
        </p>
      </section>
    </main>
  );
}
