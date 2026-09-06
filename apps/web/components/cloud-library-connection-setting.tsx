"use client";

import { useEffect, useRef, useState } from "react";
import type { prepareCloudLibraryWeb } from "@flashcards/direct-connect-webstack/cloud-library-web";
import { connectCloudLibrary, type CloudEnvironment } from "@flashcards/sync/cloud-library-bootstrap";
import { createBrowserCloudLibraryBindings } from "../lib/cloud-library-binding";
import { useI18n } from "./i18n-provider";

const messages = {
  de: {
    title: "Bibliothek mit iCloud verbinden",
    notice: "Dieser Schritt speichert eine Bibliothekskennung in deiner privaten iCloud-Datenbank und bindet dieses Browserprofil an das angemeldete Konto. Decks, Medien und Lernfortschritte werden noch nicht \u00fcbertragen. Die Bindung bleibt beim Abmelden erhalten.",
    idle: "Noch keine Kontobindung gespeichert.", saved: "Kontobindung lokal gespeichert. Der aktuelle Cloud-Zugriff ist noch nicht gepr\u00fcft.",
    busy: "Private Cloud-Bibliothek wird verbunden.", ready: "Private Cloud-Bibliothek erreichbar; Kontobindung dauerhaft gespeichert. Inhaltssynchronisierung folgt separat.",
    error: "Verbindung nicht best\u00e4tigt. Pr\u00fcfe Netzwerk, CloudKit-Schema und das urspr\u00fcnglich verbundene Apple-Konto. Eine fehlende oder ge\u00e4nderte Cloud-Bibliothek wird nicht automatisch ersetzt. Lokale Lerndaten bleiben erhalten.",
    connect: "Bibliothek verbinden / Verbindung pr\u00fcfen",
  },
  en: {
    title: "Connect library to iCloud",
    notice: "This step stores a library identifier in your private iCloud database and binds this browser profile to the signed-in account. Decks, media and learning progress are not transferred yet. Signing out keeps the binding.",
    idle: "No account binding saved yet.", saved: "Account binding saved locally. Current cloud access has not been checked yet.",
    busy: "Connecting private cloud library.", ready: "Private cloud library reachable; account binding saved durably. Content synchronization is a separate next step.",
    error: "Connection not confirmed. Check the network, CloudKit schema and the originally linked Apple account. A missing or changed cloud library is not replaced automatically. Local learning data is preserved.",
    connect: "Connect library / check connection",
  },
  es: {
    title: "Conectar biblioteca a iCloud",
    notice: "Este paso guarda un identificador de biblioteca en tu base de datos privada de iCloud y vincula este perfil del navegador a la cuenta conectada. A\u00fan no se transfieren mazos, medios ni progresos. Cerrar sesi\u00f3n conserva el v\u00ednculo.",
    idle: "A\u00fan no hay una cuenta vinculada.", saved: "V\u00ednculo guardado localmente. El acceso actual a iCloud a\u00fan no se ha comprobado.",
    busy: "Conectando biblioteca privada.", ready: "Biblioteca privada accesible; v\u00ednculo guardado de forma duradera. La sincronizaci\u00f3n de contenido es un paso posterior.",
    error: "Conexi\u00f3n no confirmada. Revisa la red, el esquema CloudKit y la cuenta Apple vinculada originalmente. No se sustituye autom\u00e1ticamente una biblioteca ausente o modificada. Los datos locales se conservan.",
    connect: "Conectar biblioteca / comprobar conexi\u00f3n",
  },
  fr: {
    title: "Relier la biblioth\u00e8que \u00e0 iCloud",
    notice: "Cette \u00e9tape enregistre un identifiant de biblioth\u00e8que dans ta base iCloud priv\u00e9e et lie ce profil de navigateur au compte connect\u00e9. Paquets, m\u00e9dias et progression ne sont pas encore transf\u00e9r\u00e9s. La d\u00e9connexion conserve ce lien.",
    idle: "Aucun compte li\u00e9 enregistr\u00e9.", saved: "Lien enregistr\u00e9 localement. L'acc\u00e8s actuel \u00e0 iCloud n'a pas encore \u00e9t\u00e9 v\u00e9rifi\u00e9.",
    busy: "Connexion \u00e0 la biblioth\u00e8que priv\u00e9e.", ready: "Biblioth\u00e8que priv\u00e9e accessible ; lien enregistr\u00e9 durablement. La synchronisation du contenu est une prochaine \u00e9tape distincte.",
    error: "Connexion non confirm\u00e9e. V\u00e9rifie le r\u00e9seau, le sch\u00e9ma CloudKit et le compte Apple li\u00e9 initialement. Une biblioth\u00e8que absente ou modifi\u00e9e n'est pas remplac\u00e9e automatiquement. Les donn\u00e9es locales sont conserv\u00e9es.",
    connect: "Relier la biblioth\u00e8que / v\u00e9rifier la connexion",
  },
};

type Status = "idle" | "saved" | "busy" | "ready" | "error";
type Session = Awaited<ReturnType<typeof prepareCloudLibraryWeb>>;

export function CloudLibraryConnectionSetting({ account, environment, session }: {
  account: string; environment: CloudEnvironment; session: Session;
}) {
  const { locale } = useI18n();
  const copy = messages[locale];
  const [status, setStatus] = useState<Status>("idle");
  const requestId = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    const request = ++requestId.current;
    void createBrowserCloudLibraryBindings().read(environment).then((binding) => {
      if (request !== requestId.current) return;
      setStatus(binding ? binding.account === account ? "saved" : "error" : "idle");
    }).catch(() => { if (request === requestId.current) setStatus("error"); });
    return () => { requestId.current += 1; };
  }, [account, environment]);

  async function connect() {
    if (busy.current) return;
    busy.current = true;
    const request = ++requestId.current;
    setStatus("busy");
    try {
      await connectCloudLibrary({
        account, environment,
        bindings: createBrowserCloudLibraryBindings(),
        storeForAccount: session.storeForAccount,
        randomUUID: () => crypto.randomUUID(),
        assertAccount: async () => {
          if (await session.account() !== account) throw new Error("Account changed");
        },
      });
      if (request === requestId.current) setStatus("ready");
    } catch {
      if (request === requestId.current) setStatus("error");
    } finally { busy.current = false; }
  }

  return (
    <div>
      <h3>{copy.title}</h3>
      <p>{copy.notice}</p>
      <p role={status === "error" ? "alert" : "status"}>{copy[status]}</p>
      <button className="setting-action" type="button" disabled={status === "busy"}
        aria-busy={status === "busy" || undefined} onClick={() => void connect()}>
        <span><strong>{copy.connect}</strong></span>
      </button>
    </div>
  );
}
