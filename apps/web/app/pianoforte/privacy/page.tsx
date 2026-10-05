import type { Metadata } from "next";

import styles from "../pianoforte.module.css";

export const metadata: Metadata = {
  title: { absolute: "Pianoforte privacy policy" },
  description:
    "How the Pianoforte piano-practice app handles local data, optional iCloud synchronization and support requests.",
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
        Last updated: 5 October 2026 · Stand: 5. Oktober 2026
      </p>

      <section lang="en" aria-labelledby="privacy-en">
        <h2 id="privacy-en">English</h2>
        <h3>Controller and contact</h3>
        <p>
          Pianoforte is a local-first piano-practice app. It has no Pianoforte
          account, advertising, tracking or analytics. The controller is Frank
          Hinkel (individual), Friedenstraße 39, D-67292 Kirchheimbolanden,
          Germany, email{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
        </p>
        <h3>Data on your device</h3>
        <p>
          Pianoforte stores imported score files, their musical metadata,
          favourites, library organisation, practice preferences, MIDI settings
          and PDF-export preferences locally on the device. Local playing
          reviews retain up to three passes with up to 1,500 note events each,
          including pitches, timing and assessment, for the most recently
          recorded score. Optional playing-trace display does not control
          whether the local review is recorded. New passes replace older ones;
          this data is not uploaded automatically. Stored app data remain until
          deleted, overwritten or removed with the app. Operating-system backups
          and copies that you exported are managed separately by you and Apple.
        </p>
        <h3>Private iCloud synchronization</h3>
        <p>
          New installations keep imported scores on the device until you enable
          “Sync imported scores with iCloud” in the Library. When enabled,
          Pianoforte automatically stores the original file, a source
          identifier, file name, title, composer, format, difficulty, colour,
          library organisation and deletion state in your private Apple CloudKit
          database. Installations that used automatic iCloud sync before this
          setting was introduced keep sync enabled until you turn it off. If
          iCloud is unavailable, imported scores remain usable on the device.
          Pianoforte does not operate a separate cloud server or make your
          scores public. Apple provides the iCloud service under your Apple
          account and its terms.
        </p>
        <p>
          Turning sync off stops new synchronization; an operation already in
          progress may finish. It does not delete scores already stored in
          iCloud. To delete one, re-enable sync and use “Delete from iCloud” in
          the Library; this also removes the local copy. Removing only a local
          download leaves its iCloud copy in place. Deleting a cloud score
          removes its file and readable metadata. A minimal source identifier
          and deletion time may remain as a sync marker so another device does
          not restore it. Removing the app deletes its local data but does not
          itself delete your private iCloud data; use the Library’s cloud-delete
          action to remove cloud scores.
        </p>
        <h3>MIDI</h3>
        <p>
          Bluetooth and USB MIDI are optional. When the user connects a MIDI
          piano, Pianoforte processes note events and device/connection
          information on the device so the keyboard can control practice and
          playback. There is no automatic MIDI/audio streaming or remote
          transcription. “Play into score” converts a MIDI performance into a
          score locally. If you save that MIDI score to the library and enable
          iCloud sync, its original MIDI file can be synchronized like any other
          score. Playing reviews, practice preferences and local diagnostics are
          not part of that score synchronization. Bluetooth access can be
          denied; the app remains usable without MIDI hardware.
        </p>
        <h3>Diagnostics, clipboard and PDF export</h3>
        <p>
          Local diagnostics include startup timings and limited MIDI/following
          information, which can include the current score title, pitches and
          cursor positions. Startup reports and the latest following diagnostic
          are stored locally; the bounded audio/MIDI event trace stays in
          memory. No diagnostic report is sent automatically. The copy action
          puts the requested report on the system clipboard. You decide whether
          to paste or share it; system clipboard features, such as Apple's
          Universal Clipboard, are governed by your device settings. PDF export
          creates a temporary local PDF and opens Apple's preview or share
          interface. Recipients and exported copies are your choice.
        </p>
        <h3>Support</h3>
        <p>
          If the user contacts support, the controller processes the message,
          contact details and any diagnostic information the user chooses to
          send solely to answer the request. Support emails are deleted when the
          request is resolved, unless a legal obligation requires retention.
        </p>
        <p>
          Providing an email address and a description of the problem is
          necessary for an email reply; score files and diagnostic reports are
          optional. We do not use support messages for marketing. Support
          correspondence is processed to answer your request and maintain a
          functioning support service, based on legitimate interests under
          Article 6(1)(f) GDPR; where the request concerns providing the app
          service, Article 6(1)(b) applies. Mandatory retention is based on
          Article 6(1)(c). The legitimate interest is resolving technical
          problems with the minimum information required. Email
          transport/storage involves the email services used by sender and
          recipient.
        </p>
        <h3>No tracking or advertising</h3>
        <p>
          Pianoforte does not sell personal data, track users across apps or
          websites, show personalised advertising, or use third-party analytics
          SDKs. The app uses Apple system services and the libraries identified
          in its third-party notices.
        </p>
        <h3>Your choices and rights</h3>
        <p>
          Depending on applicable law, users may request access, correction,
          deletion, restriction or portability and may object to processing.
          Requests can be sent to{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
          Users may also complain to their competent data-protection authority.
          Where consent is the applicable basis, it can be withdrawn for the
          future. The optional iCloud switch controls future score
          synchronization; existing cloud copies must be deleted separately.
          Apple provides iCloud under its own account, privacy and service
          terms; a toggle in Pianoforte does not replace your Apple agreement.
          There is no automated decision-making with legal or similarly
          significant effects. Musical timing feedback is computed locally.
        </p>
        <h3>This public website</h3>
        <p>
          Opening this public website sends HTTPS request information, including
          your IP address, to our host, netcup GmbH, Emmy-Noether-Straße 10,
          76131 Karlsruhe, Germany. The server is located in Nuremberg, Germany.
          We process these requests to deliver and protect the website under
          Article 6(1)(f) GDPR. The HTTPS proxy does not keep an HTTP access
          log. Website and HTTPS-proxy operating/error logs can include
          technical connection information; each container's logs rotate at 10
          MB per file and retain at most three files. They are replaced as new
          logs arrive or when the container is replaced; this is a size limit,
          not a fixed retention period in days. Unlike local app use, website
          requests and support emails necessarily involve server processing.
        </p>
      </section>

      <section lang="de" aria-labelledby="privacy-de">
        <h2 id="privacy-de">Deutsch</h2>
        <h3>Verantwortlicher und Kontakt</h3>
        <p>
          Pianoforte ist eine lokal ausgerichtete Klavier-Übungs-App. Es gibt
          kein Pianoforte-Konto, keine Werbung, kein Tracking und keine
          Analysedienste. Verantwortlich ist Frank Hinkel (Einzelperson),
          Friedenstraße 39, D-67292 Kirchheimbolanden, Deutschland, E-Mail{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
        </p>
        <h3>Daten auf dem Gerät</h3>
        <p>
          Importierte Notendateien, musikalische Metadaten, Favoriten,
          Bibliotheksorganisation, Übungseinstellungen, MIDI-Einstellungen und
          PDF-Exportvorgaben speichert Pianoforte lokal auf dem Gerät. Die
          lokale Spielauswertung behält für die zuletzt aufgezeichnete Partitur
          bis zu drei Durchläufe mit jeweils bis zu 1.500 Notenereignissen
          einschließlich Tonhöhen, Timing und Bewertung. Der Schalter für
          sichtbare Spielspuren steuert nicht die lokale Aufzeichnung für diese
          Auswertung. Neue Durchläufe ersetzen ältere; eine automatische
          Übertragung findet nicht statt. Gespeicherte App-Daten bleiben bis zum
          Löschen, Überschreiben oder Entfernen der App bestehen.
          Betriebssystem-Backups und selbst exportierte Kopien verwaltest du
          getrennt über deine Geräte und die Apple-Dienste.
        </p>
        <h3>Private iCloud-Synchronisierung</h3>
        <p>
          Bei neuen Installationen bleiben importierte Noten auf dem Gerät, bis
          du in der Bibliothek „Sync imported scores with iCloud“ aktivierst.
          Danach speichert Pianoforte automatisch Originaldatei, Quellkennung,
          Dateiname, Titel, Komponist, Format, Schwierigkeit, Farbe,
          Bibliotheksorganisation und Löschstatus in deiner privaten
          Apple-CloudKit-Datenbank. Bei Installationen, die bereits vor
          Einführung dieses Schalters automatisch synchronisiert haben, bleibt
          die Synchronisierung aktiv, bis du sie ausschaltest. Ohne
          iCloud-Zugriff bleiben importierte Noten lokal nutzbar. Pianoforte
          betreibt keinen eigenen Cloud-Server und veröffentlicht deine Noten
          nicht. Apple stellt iCloud über dein Apple-Konto und nach seinen
          Bedingungen bereit.
        </p>
        <p>
          Ausschalten stoppt neue Synchronisierungsvorgänge; ein bereits
          laufender Vorgang kann noch abgeschlossen werden. Bereits in iCloud
          gespeicherte Stücke werden dadurch nicht gelöscht. Zum Löschen kannst
          du die Synchronisierung wieder einschalten und in der Bibliothek
          „Delete from iCloud“ wählen; dabei wird auch die lokale Kopie
          gelöscht. Nur die lokale Kopie zu entfernen, lässt die iCloud-Kopie
          bestehen. Beim Löschen eines Cloud-Stücks werden Datei und lesbare
          Metadaten entfernt. Eine minimale Quellkennung und der Löschzeitpunkt
          können als Synchronisationsmarker verbleiben, damit ein anderes Gerät
          das Stück nicht wiederherstellt. Das Entfernen der App löscht lokale
          Daten, nicht automatisch private iCloud-Daten; Cloud-Stücke können in
          der Bibliothek gesondert gelöscht werden.
        </p>
        <h3>MIDI</h3>
        <p>
          Bluetooth- und USB-MIDI sind optional. Bei Verbindung eines
          MIDI-Klaviers verarbeitet Pianoforte Notenereignisse sowie Geräte- und
          Verbindungsdaten lokal, um Übung und Wiedergabe zu steuern. Es gibt
          keine automatische MIDI-/Audio-Übertragung und keine externe
          Transkription. „Spiel in Noten“ erzeugt aus einem MIDI-Spiel lokal
          eine Partitur. Speicherst du diese MIDI-Partitur in der Bibliothek und
          aktivierst iCloud, kann ihre ursprüngliche MIDI-Datei wie andere
          Partituren synchronisiert werden. Spielauswertungen,
          Übungseinstellungen und lokale Diagnosen gehören nicht zu dieser
          Partitursynchronisierung. Bluetooth kann abgelehnt werden; die App
          bleibt ohne MIDI-Hardware nutzbar.
        </p>
        <h3>Diagnosen, Zwischenablage und PDF-Export</h3>
        <p>
          Lokale Diagnosen enthalten Startzeiten und begrenzte
          MIDI-/Verfolgungsdaten, gegebenenfalls mit Stücktitel, Tonhöhen und
          Cursorpositionen. Startberichte und die letzte Verfolgungsdiagnose
          werden lokal gespeichert; der begrenzte Audio-/MIDI-Ereignisverlauf
          bleibt im Arbeitsspeicher. Pianoforte überträgt diese Berichte nicht
          automatisch. Die Kopieraktion legt den gewählten Bericht in die
          Systemzwischenablage. Du entscheidest über Einfügen und Weitergabe;
          Funktionen wie Apples geräteübergreifende Zwischenablage richten sich
          nach deinen Systemeinstellungen. Der PDF-Export erzeugt eine temporäre
          lokale PDF und öffnet Apples Vorschau beziehungsweise Teilen-Dialog.
          Empfänger und exportierte Kopien wählst du selbst.
        </p>
        <h3>Support</h3>
        <p>
          Bei einer Supportanfrage verarbeitet der Verantwortliche Nachricht,
          Kontaktdaten und freiwillig gesendete Diagnoseinformationen
          ausschließlich zur Bearbeitung der Anfrage. Support-E-Mails werden
          nach Abschluss der Anfrage gelöscht, sofern keine gesetzliche Pflicht
          zur längeren Aufbewahrung besteht.
        </p>
        <p>
          Für eine Antwort per E-Mail benötigen wir deine E-Mail-Adresse und
          eine Problembeschreibung; Notendateien und Diagnosen sind freiwillig.
          Supportdaten werden nicht für Werbung verwendet. Die Bearbeitung und
          der Betrieb eines funktionierenden Supports beruhen auf berechtigtem
          Interesse nach Art. 6 Abs. 1 lit. f DSGVO; soweit die Anfrage die
          Bereitstellung des App-Dienstes betrifft, auf Art. 6 Abs. 1 lit. b.
          Gesetzliche Aufbewahrung beruht auf Art. 6 Abs. 1 lit. c. Das
          berechtigte Interesse ist die Behebung technischer Probleme mit den
          dafür erforderlichen Angaben. E-Mail-Übertragung und -Speicherung
          beziehen die vom Absender und Empfänger eingesetzten E-Mail-Dienste
          ein.
        </p>
        <h3>Keine Werbung oder Analyse</h3>
        <p>
          Pianoforte verkauft keine personenbezogenen Daten, verfolgt Nutzer
          nicht über Apps oder Websites hinweg, zeigt keine personalisierte
          Werbung und verwendet keine Analyse-SDKs. Die App nutzt
          Apple-Systemdienste und die in den Drittanbieterhinweisen genannten
          Bibliotheken.
        </p>
        <h3>Entscheidungen und Rechte</h3>
        <p>
          Abhängig vom anwendbaren Recht bestehen Rechte auf Auskunft,
          Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
          Widerspruch. Anfragen gehen an{" "}
          <a href="mailto:pianofortel@hi-sys.de">pianofortel@hi-sys.de</a>.
          Außerdem besteht ein Beschwerderecht bei der zuständigen
          Datenschutzaufsicht. Soweit Einwilligung die anwendbare
          Rechtsgrundlage ist, kann sie für die Zukunft widerrufen werden. Der
          optionale iCloud-Schalter steuert künftige Partitursynchronisierung;
          vorhandene Cloud-Kopien sind getrennt zu löschen. Apple stellt iCloud
          nach seinen eigenen Konto-, Datenschutz- und Dienstbedingungen bereit;
          der Schalter ersetzt deine Apple-Vereinbarung nicht. Es findet keine
          automatisierte Entscheidung mit rechtlicher oder vergleichbar
          erheblicher Wirkung statt. Musikalische Timing-Rückmeldungen werden
          lokal berechnet.
        </p>
        <h3>Diese öffentliche Website</h3>
        <p>
          Beim Öffnen dieser öffentlichen Website werden HTTPS-Anfragedaten
          einschließlich deiner IP-Adresse an unseren Host netcup GmbH,
          Emmy-Noether-Straße 10, 76131 Karlsruhe, Deutschland, übermittelt. Der
          Server steht in Nürnberg, Deutschland. Wir verarbeiten diese Anfragen
          zur Bereitstellung und Absicherung der Website nach Art. 6 Abs. 1 lit.
          f DSGVO. Der HTTPS-Proxy führt kein HTTP-Zugriffsprotokoll. Betriebs-
          und Fehlerprotokolle der Website und des HTTPS-Proxys können
          technische Verbindungsangaben enthalten; sie rotieren pro Container
          bei 10 MB je Datei und behalten höchstens drei Dateien. Neue Einträge
          oder das Ersetzen des Containers lösen ältere Protokolle ab; dies ist
          eine Größenbegrenzung, keine feste Aufbewahrungsfrist in Tagen. Anders
          als rein lokale App-Nutzung beziehen Website-Aufrufe und
          Support-E-Mails zwangsläufig Serververarbeitung ein.
        </p>
      </section>
    </main>
  );
}
