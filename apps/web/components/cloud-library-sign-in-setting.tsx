"use client";

import { Capacitor } from "@capacitor/core";
import { prepareCloudLibraryWeb } from "@flashcards/direct-connect-webstack/cloud-library-web";
import { useEffect, useRef, useState } from "react";
import {
  cloudLibrarySignInConfiguration,
  cloudSignInButtonId,
  cloudSignOutButtonId,
} from "../lib/cloud-library-sign-in";
import { useI18n } from "./i18n-provider";
import { CloudLibraryConnectionSetting } from "./cloud-library-connection-setting";

const messages = {
  de: {
    title: "iCloud-Anmeldung",
    notice: "Erst beim Start wird eine Verbindung zu Apple aufgebaut. Apple erh\u00e4lt dabei technische Verbindungsdaten und verwaltet die Anmeldung. Die Sitzung wird durch CloudKit JS im Browser gespeichert. Dein Apple-Passwort gibst du ausschlie\u00dflich bei Apple ein.",
    scope: "Nur Anmeldung: Decks, Medien und Lernfortschritte werden noch nicht synchronisiert. Abmelden l\u00f6scht keine lokalen oder iCloud-Lerndaten.",
    missing: "Noch nicht eingerichtet: CloudKit-API-Token und Umgebung fehlen oder sind ung\u00fcltig.",
    idle: "Anmeldung noch nicht gestartet.", busy: "Verbindung zu Apple wird aufgebaut.",
    signedIn: "Bei iCloud angemeldet. Synchronisierung ist noch nicht aktiv.",
    signedOut: "Nicht bei iCloud angemeldet.",
    error: "Anmeldung nicht erreichbar. Pr\u00fcfe Internetverbindung, API-Token und die f\u00fcr diese Website erlaubte Domain. Versuche es erneut; bei Konfigurations\u00e4nderungen lade die App neu.",
    start: "iCloud-Anmeldung starten", refresh: "Anmeldestatus erneut laden",
    development: "Testumgebung (Development)", production: "Produktionsumgebung",
  },
  en: {
    title: "iCloud sign-in",
    notice: "Apple is contacted only when you start. Apple receives technical connection data and manages authentication. CloudKit JS stores the session in this browser. Enter your Apple password only on Apple's website.",
    scope: "Sign-in only: decks, media and learning progress are not synchronized yet. Signing out does not delete local or iCloud learning data.",
    missing: "Not configured: the CloudKit API token or environment is missing or invalid.",
    idle: "Sign-in has not started.", busy: "Connecting to Apple.",
    signedIn: "Signed in to iCloud. Synchronization is not active yet.",
    signedOut: "Not signed in to iCloud.",
    error: "Sign-in unavailable. Check your connection, API token and the allowed domain for this website. Try again; reload the app after configuration changes.",
    start: "Start iCloud sign-in", refresh: "Refresh sign-in status",
    development: "Test environment (Development)", production: "Production environment",
  },
  es: {
    title: "Inicio de sesi\u00f3n en iCloud",
    notice: "Apple recibe datos t\u00e9cnicos de conexi\u00f3n y gestiona la autenticaci\u00f3n solo cuando inicias el proceso. CloudKit JS guarda la sesi\u00f3n en este navegador. Introduce tu contrase\u00f1a de Apple solo en la web de Apple.",
    scope: "Solo autenticaci\u00f3n: los mazos, medios y progresos a\u00fan no se sincronizan. Cerrar sesi\u00f3n no elimina datos de aprendizaje locales ni de iCloud.",
    missing: "Sin configurar: falta el token API de CloudKit o el entorno, o no son v\u00e1lidos.",
    idle: "El inicio de sesi\u00f3n no ha comenzado.", busy: "Conectando con Apple.",
    signedIn: "Sesi\u00f3n iniciada en iCloud. La sincronizaci\u00f3n a\u00fan no est\u00e1 activa.",
    signedOut: "Sesi\u00f3n de iCloud cerrada.",
    error: "Inicio de sesi\u00f3n no disponible. Revisa la conexi\u00f3n, el token API y el dominio permitido. Int\u00e9ntalo de nuevo; recarga la app si cambia la configuraci\u00f3n.",
    start: "Iniciar autenticaci\u00f3n en iCloud", refresh: "Actualizar estado de sesi\u00f3n",
    development: "Entorno de prueba (Development)", production: "Entorno de producci\u00f3n",
  },
  fr: {
    title: "Connexion iCloud",
    notice: "Apple re\u00e7oit les donn\u00e9es techniques de connexion et g\u00e8re l'authentification uniquement lorsque tu la d\u00e9marres. CloudKit JS conserve la session dans ce navigateur. Saisis ton mot de passe Apple uniquement sur le site d'Apple.",
    scope: "Authentification uniquement : paquets, m\u00e9dias et progression ne sont pas encore synchronis\u00e9s. La d\u00e9connexion ne supprime aucune donn\u00e9e d'apprentissage locale ou iCloud.",
    missing: "Non configur\u00e9 : le jeton API CloudKit ou l'environnement manque ou est invalide.",
    idle: "La connexion n'a pas encore commenc\u00e9.", busy: "Connexion \u00e0 Apple en cours.",
    signedIn: "Connect\u00e9 \u00e0 iCloud. La synchronisation n'est pas encore active.",
    signedOut: "Non connect\u00e9 \u00e0 iCloud.",
    error: "Connexion indisponible. V\u00e9rifie le r\u00e9seau, le jeton API et le domaine autoris\u00e9. R\u00e9essaie ; recharge l'app apr\u00e8s un changement de configuration.",
    start: "D\u00e9marrer la connexion iCloud", refresh: "Actualiser l'\u00e9tat de connexion",
    development: "Environnement de test (Development)", production: "Environnement de production",
  },
};

type Status = "idle" | "busy" | "signedIn" | "signedOut" | "error";

export function CloudLibrarySignInSetting() {
  const { locale } = useI18n();
  const copy = messages[locale];
  const [browser, setBrowser] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [account, setAccount] = useState<string | null>(null);
  const [cloudSession, setCloudSession] = useState<Awaited<ReturnType<typeof prepareCloudLibraryWeb>> | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const configuration = cloudLibrarySignInConfiguration(
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN,
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT,
  );

  useEffect(() => {
    setBrowser(!Capacitor.isNativePlatform());
    return () => {
      generation.current += 1;
      unsubscribe.current?.();
    };
  }, []);

  async function start() {
    if (!configuration || inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    unsubscribe.current?.();
    setStatus("busy");
    setAccount(null);
    setCloudSession(null);
    try {
      const session = await prepareCloudLibraryWeb(configuration);
      if (request !== generation.current) return;
      setCloudSession(session);
      unsubscribe.current = session.observeAccount(
        (account) => {
          if (request === generation.current) {
            setStatus(account ? "signedIn" : "signedOut");
            setAccount(account);
          }
        },
        () => {
          if (request === generation.current) {
            setStatus("error");
            setAccount(null);
          }
        },
      );
    } catch {
      // Do not render/log SDK error objects containing credentials or identity.
      if (request === generation.current) setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (!browser) return null;
  return (
    <section className="settings-section" aria-labelledby="cloud-sign-in-title">
      <h2 id="cloud-sign-in-title">{copy.title}</h2>
      <p>{copy.notice}</p>
      <p>{copy.scope}</p>
      {configuration && <p>{copy[configuration.environment]}</p>}
      <p role={status === "error" ? "alert" : "status"}>
        {configuration ? copy[status] : copy.missing}
      </p>
      <button
        className="setting-action"
        type="button"
        disabled={!configuration || status === "busy"}
        aria-busy={status === "busy" || undefined}
        onClick={() => void start()}
      >
        <span><strong>{status === "idle" ? copy.start : copy.refresh}</strong></span>
      </button>
      {/* Apple owns the children. Keep both hosts mounted across auth changes. */}
      <div id={cloudSignInButtonId} />
      <div id={cloudSignOutButtonId} />
      {account && cloudSession && configuration && (
        <CloudLibraryConnectionSetting key={`${configuration.environment}:${account}`}
          account={account} environment={configuration.environment} session={cloudSession} />
      )}
    </section>
  );
}
