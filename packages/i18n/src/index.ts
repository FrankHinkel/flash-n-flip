import { generatedUiMessages } from "./ui-messages.generated.js";

export const product = {
  name: "Flash-n-Flip",
  domain: "flash-n-flip.com",
  motto: "Flash, Flip and Remember",
} as const;

export const en = {
  navigation: {
    today: "Today",
    decks: "My decks",
    learn: "Study",
    discover: "Discover",
    settings: "Settings",
  },
  study: {
    question: "Question",
    answer: "Answer",
    reveal: "Show answer",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    complete: "You are done for today.",
  },
  sync: {
    offline: "Offline – changes will sync later.",
    synced: "All changes are synchronized.",
  },
  moderation: {
    submitted: "Submitted",
    inReview: "In review",
    changesRequested: "Changes requested",
    approved: "Approved",
    published: "Published",
    suspended: "Suspended",
  },
} as const;

type TranslationShape = {
  [Section in keyof typeof en]: {
    [Key in keyof (typeof en)[Section]]: string;
  };
};

export const de: TranslationShape = {
  navigation: {
    today: "Heute",
    decks: "Meine Lernsets",
    learn: "Lernen",
    discover: "Entdecken",
    settings: "Einstellungen",
  },
  study: {
    question: "Frage",
    answer: "Antwort",
    reveal: "Antwort zeigen",
    again: "Nochmal",
    hard: "Schwer",
    good: "Gut",
    easy: "Leicht",
    complete: "Für heute ist alles geschafft.",
  },
  sync: {
    offline: "Offline – Änderungen werden später synchronisiert.",
    synced: "Alle Änderungen wurden synchronisiert.",
  },
  moderation: {
    submitted: "Eingereicht",
    inReview: "In Prüfung",
    changesRequested: "Änderungen nötig",
    approved: "Freigegeben",
    published: "Veröffentlicht",
    suspended: "Gesperrt",
  },
};

export const es: TranslationShape = {
  navigation: {
    today: "Hoy",
    decks: "Mis mazos",
    learn: "Estudiar",
    discover: "Descubrir",
    settings: "Ajustes",
  },
  study: {
    question: "Pregunta",
    answer: "Respuesta",
    reveal: "Mostrar respuesta",
    again: "Otra vez",
    hard: "Difícil",
    good: "Bien",
    easy: "Fácil",
    complete: "Has terminado por hoy.",
  },
  sync: {
    offline: "Sin conexión: los cambios se sincronizarán más tarde.",
    synced: "Todos los cambios están sincronizados.",
  },
  moderation: {
    submitted: "Enviado",
    inReview: "En revisión",
    changesRequested: "Cambios solicitados",
    approved: "Aprobado",
    published: "Publicado",
    suspended: "Suspendido",
  },
};

export const fr: TranslationShape = {
  navigation: {
    today: "Aujourd’hui",
    decks: "Mes paquets",
    learn: "Étudier",
    discover: "Découvrir",
    settings: "Réglages",
  },
  study: {
    question: "Question",
    answer: "Réponse",
    reveal: "Afficher la réponse",
    again: "À revoir",
    hard: "Difficile",
    good: "Bien",
    easy: "Facile",
    complete: "Vous avez terminé pour aujourd’hui.",
  },
  sync: {
    offline: "Hors ligne : les modifications seront synchronisées plus tard.",
    synced: "Toutes les modifications sont synchronisées.",
  },
  moderation: {
    submitted: "Envoyé",
    inReview: "En cours d’examen",
    changesRequested: "Modifications demandées",
    approved: "Approuvé",
    published: "Publié",
    suspended: "Suspendu",
  },
};

export const supportedLocales = ["en", "de", "es", "fr"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";
export const translations = { en, de, es, fr } as const;

const semanticUiMessages = {
  "app.loading": {
    en: "Loading application …",
    de: "Anwendung wird geladen …",
    es: "Cargando la aplicación…",
    fr: "Chargement de l’application…",
  },
  "app.preparingLocal": {
    en: "Preparing local application …",
    de: "Lokale Anwendung wird vorbereitet …",
    es: "Preparando la aplicación local…",
    fr: "Préparation de l’application locale…",
  },
  "navigation.decks": {
    en: "Decks",
    de: "Lernsets",
    es: "Mazos",
    fr: "Paquets",
  },
  "dashboard.deckCountLabel": {
    en: "Decks",
    de: "Lernsets",
    es: "Mazos",
    fr: "Paquets",
  },
  "settings.availableLanguages": {
    en: "English / German / Spanish / French",
    de: "Englisch / Deutsch / Spanisch / Französisch",
    es: "Inglés / alemán / español / francés",
    fr: "Anglais / allemand / espagnol / français",
  },
  "memory.title": {
    en: "Memory",
    de: "Memory",
    es: "Memoria",
    fr: "Mémoire",
  },
  "pwa.platformApple": {
    en: "iPhone & iPad",
    de: "iPhone & iPad",
    es: "iPhone y iPad",
    fr: "iPhone et iPad",
  },
  "pwa.platformOther": {
    en: "Mac, Windows & Android",
    de: "Mac, Windows & Android",
    es: "Mac, Windows y Android",
    fr: "Mac, Windows et Android",
  },
  "anki.sourceDeckPlaceholder": {
    en: "General knowledge/**",
    de: "Allgemeinwissen/**",
    es: "Conocimientos generales/**",
    fr: "Culture générale/**",
  },
  "anki.targetDeckPlaceholder": {
    en: "Languages/German/Vocabulary",
    de: "Sprachen/Deutsch/Wortschatz",
    es: "Idiomas/Alemán/Vocabulario",
    fr: "Langues/Allemand/Vocabulaire",
  },
  "anki.directionSourceToTarget": {
    en: "A → B",
    de: "A → B",
    es: "A → B",
    fr: "A → B",
  },
  "anki.directionTargetToSource": {
    en: "B → A",
    de: "B → A",
    es: "B → A",
    fr: "B → A",
  },
  "anki.languageHubProfile": {
    en: "Language Hub",
    de: "Sprachzentrale",
    es: "Centro de idiomas",
    fr: "Centre de langues",
  },
  "editor.tags": {
    en: "Tags",
    de: "Schlagwörter",
    es: "Etiquetas",
    fr: "Étiquettes",
  },
  "portable.notFoundTitle": {
    en: "Page not found",
    de: "Seite nicht gefunden",
    es: "Página no encontrada",
    fr: "Page introuvable",
  },
  "portable.notFoundDescription": {
    en: "This local app version does not recognize the requested page.",
    de: "Diese lokale App-Version kennt die angeforderte Seite nicht.",
    es: "Esta versión local de la aplicación no reconoce la página solicitada.",
    fr: "Cette version locale de l’application ne reconnaît pas la page demandée.",
  },
  "import.csvTsv": {
    en: "CSV / TSV",
    de: "CSV / TSV",
    es: "CSV / TSV",
    fr: "CSV / TSV",
  },
  "catalog.supportedLanguageCodes": {
    en: "EN · DE · FR · ES",
    de: "EN · DE · FR · ES",
    es: "EN · DE · FR · ES",
    fr: "EN · DE · FR · ES",
  },
  "catalog.release.signed": {
    en: "Signed {0}",
    de: "Signiert {0}",
    es: "Firmado {0}",
    fr: "Signé le {0}",
  },
  "catalog.release.upToDate": {
    en: "Up to date",
    de: "Aktuell",
    es: "Actualizado",
    fr: "À jour",
  },
  "catalog.release.updateAvailable": {
    en: "Update available",
    de: "Aktualisierung verfügbar",
    es: "Actualización disponible",
    fr: "Mise à jour disponible",
  },
  "catalog.release.versionUnknown": {
    en: "Installed version unknown",
    de: "Installierte Version unbekannt",
    es: "Versión instalada desconocida",
    fr: "Version installée inconnue",
  },
  "study.rating.again": {
    en: "Again",
    de: "Nochmal",
    es: "Otra vez",
    fr: "À revoir",
  },
  "study.rating.hard": {
    en: "Hard",
    de: "Schwer",
    es: "Difícil",
    fr: "Difficile",
  },
  "study.rating.good": {
    en: "Good",
    de: "Gut",
    es: "Bien",
    fr: "Bien",
  },
  "study.rating.easy": {
    en: "Easy",
    de: "Leicht",
    es: "Fácil",
    fr: "Facile",
  },
  "study.strategy.balanced": {
    en: "Balanced",
    de: "Ausgewogen",
    es: "Equilibrado",
    fr: "Équilibré",
  },
  "study.strategy.longTerm": {
    en: "Long-term",
    de: "Langfristig",
    es: "A largo plazo",
    fr: "Long terme",
  },
  "study.strategy.exam": {
    en: "Exam",
    de: "Prüfung",
    es: "Examen",
    fr: "Examen",
  },
  "study.strategy.overview": {
    en: "Overview",
    de: "Überblick",
    es: "Resumen",
    fr: "Vue d’ensemble",
  },
  "study.strategy.custom": {
    en: "Custom",
    de: "Benutzerdefiniert",
    es: "Personalizado",
    fr: "Personnalisé",
  },
  "study.pace.noData": {
    en: "No pace data yet",
    de: "Noch keine Tempodaten",
    es: "Aún no hay datos de ritmo",
    fr: "Aucune donnée de rythme pour le moment",
  },
  "study.pace.tooSlow": {
    en: "Well behind the target pace",
    de: "Deutlich hinter dem Zieltempo",
    es: "Muy por debajo del ritmo objetivo",
    fr: "Très en retard sur le rythme cible",
  },
  "study.pace.slow": {
    en: "A little behind the target pace",
    de: "Etwas hinter dem Zieltempo",
    es: "Algo por debajo del ritmo objetivo",
    fr: "Un peu en retard sur le rythme cible",
  },
  "study.pace.onTrack": {
    en: "In the target corridor",
    de: "Im Zielkorridor",
    es: "Dentro del ritmo objetivo",
    fr: "Dans la plage cible",
  },
  "study.pace.fast": {
    en: "Faster than planned",
    de: "Schneller als geplant",
    es: "Más rápido de lo previsto",
    fr: "Plus rapide que prévu",
  },
  "study.pace.tooFast": {
    en: "Pace may be too high",
    de: "Tempo möglicherweise zu hoch",
    es: "El ritmo puede ser demasiado alto",
    fr: "Le rythme est peut-être trop élevé",
  },
  "anki.fieldRole.primaryA": {
    en: "Main side A",
    de: "Hauptseite A",
    es: "Lado principal A",
    fr: "Face principale A",
  },
  "anki.fieldRole.primaryB": {
    en: "Main side B",
    de: "Hauptseite B",
    es: "Lado principal B",
    fr: "Face principale B",
  },
  "anki.fieldRole.mediaA": {
    en: "Media side A",
    de: "Medienseite A",
    es: "Multimedia del lado A",
    fr: "Média de la face A",
  },
  "anki.fieldRole.mediaB": {
    en: "Media side B",
    de: "Medienseite B",
    es: "Multimedia del lado B",
    fr: "Média de la face B",
  },
  "anki.fieldRole.hint": {
    en: "Hint",
    de: "Hinweis",
    es: "Pista",
    fr: "Indice",
  },
  "anki.fieldRole.hintMedia": {
    en: "Hint media",
    de: "Hinweismedium",
    es: "Multimedia de la pista",
    fr: "Média de l’indice",
  },
  "anki.fieldRole.category": {
    en: "Category",
    de: "Kategorie",
    es: "Categoría",
    fr: "Catégorie",
  },
  "anki.fieldRole.order": {
    en: "Order",
    de: "Reihenfolge",
    es: "Orden",
    fr: "Ordre",
  },
  "anki.fieldRole.sourceId": {
    en: "Source ID",
    de: "Quell-ID",
    es: "ID de origen",
    fr: "ID source",
  },
  "anki.fieldRole.ignore": {
    en: "Ignore",
    de: "Ignorieren",
    es: "Ignorar",
    fr: "Ignorer",
  },
  "anki.insert.question": {
    en: "Insert field into question",
    de: "Feld in Frage einfügen",
    es: "Insertar campo en la pregunta",
    fr: "Insérer le champ dans la question",
  },
  "anki.insert.answer": {
    en: "Insert field into answer",
    de: "Feld in Antwort einfügen",
    es: "Insertar campo en la respuesta",
    fr: "Insérer le champ dans la réponse",
  },
  "catalog.tooLarge": {
    en: "Collection too large (maximum 100,000 changes).",
    de: "Sammlung zu groß (max. 100.000 Änderungen).",
    es: "La colección es demasiado grande (máximo 100.000 cambios).",
    fr: "La collection est trop volumineuse (100 000 modifications maximum).",
  },
  "catalog.installGeographyFailed": {
    en: "The geography deck could not be downloaded.",
    de: "Das Geografie-Lernset konnte nicht heruntergeladen werden.",
    es: "No se pudo descargar el mazo de geografía.",
    fr: "Le paquet de géographie n’a pas pu être téléchargé.",
  },
  "catalog.installConjugationFailed": {
    en: "The conjugation collection could not be installed.",
    de: "Die Konjugationssammlung konnte nicht installiert werden.",
    es: "No se pudo instalar la colección de conjugación.",
    fr: "La collection de conjugaison n’a pas pu être installée.",
  },
  "catalog.installIrregularVerbsFailed": {
    en: "The irregular-verbs collection could not be installed.",
    de: "Die Irregular-Verbs-Sammlung konnte nicht installiert werden.",
    es: "No se pudo instalar la colección de verbos irregulares.",
    fr: "La collection de verbes irréguliers n’a pas pu être installée.",
  },
  "catalog.installCoreLanguagesFailed": {
    en: "The Core Languages collection could not be installed.",
    de: "Die Core-Languages-Sammlung konnte nicht installiert werden.",
    es: "No se pudo instalar la colección Core Languages.",
    fr: "La collection Core Languages n’a pas pu être installée.",
  },
  "catalog.installDeveloperReferenceFailed": {
    en: "The Developer Reference could not be installed.",
    de: "Die Developer Reference konnte nicht installiert werden.",
    es: "No se pudo instalar Developer Reference.",
    fr: "Developer Reference n’a pas pu être installée.",
  },
  "catalog.installHelpFailed": {
    en: "The Flash-n-Flip Help reference could not be installed.",
    de: "Die Flash-n-Flip-Hilfereferenz konnte nicht installiert werden.",
    es: "No se pudo instalar la referencia de ayuda de Flash-n-Flip.",
    fr: "La référence d’aide de Flash-n-Flip n’a pas pu être installée.",
  },
  "dashboard.todayPlan": {
    en: "Today’s plan contains {0} cards.",
    de: "Dein Tagesplan umfasst {0} Karten.",
    es: "El plan de hoy contiene {0} tarjetas.",
    fr: "Le programme du jour contient {0} cartes.",
  },
  "dashboard.todayPlanAria": {
    en: "{0} cards in today’s plan",
    de: "{0} Karten im Tagesplan",
    es: "{0} tarjetas en el plan de hoy",
    fr: "{0} cartes dans le programme du jour",
  },
  "dashboard.todaySummary": {
    en: "{0} reviews + up to {1} new cards · about {2} min. {3}",
    de: "{0} Wiederholungen + bis zu {1} neue Karten · ca. {2} Min. {3}",
    es: "{0} repasos + hasta {1} tarjetas nuevas · unos {2} min. {3}",
    fr: "{0} révisions + jusqu’à {1} nouvelles cartes · environ {2} min. {3}",
  },
  "dashboard.deferredReviews": {
    en: "{0} difficult reviews remain due.",
    de: "{0} schwierige Wiederholungen bleiben fällig.",
    es: "Quedan {0} repasos difíciles pendientes.",
    fr: "{0} révisions difficiles restent à effectuer.",
  },
  "deck.browseReference": {
    en: "Browse reference {0}",
    de: "Referenz {0} durchblättern",
    es: "Consultar la referencia {0}",
    fr: "Parcourir la référence {0}",
  },
  "deck.study": {
    en: "Study {0}",
    de: "{0} lernen",
    es: "Estudiar {0}",
    fr: "Étudier {0}",
  },
  "deck.browse": {
    en: "Browse {0}",
    de: "{0} durchblättern",
    es: "Consultar {0}",
    fr: "Parcourir {0}",
  },
  "deck.studyNow": {
    en: "Study {0} now",
    de: "{0} jetzt üben",
    es: "Estudiar {0} ahora",
    fr: "Étudier {0} maintenant",
  },
  "editor.question": {
    en: "Question",
    de: "Frage",
    es: "Pregunta",
    fr: "Question",
  },
  "editor.referenceFront": {
    en: "Reference content (front, optional)",
    de: "Referenzinhalt (Vorderseite, optional)",
    es: "Contenido de referencia (anverso, opcional)",
    fr: "Contenu de référence (recto, facultatif)",
  },
  "import.existingRecognized": {
    en: "{0} existing cards were recognized. Updating preserves their learning progress and keeps removed source cards until you explicitly clean them up.",
    de: "{0} vorhandene Karten wurden erkannt. Eine Aktualisierung erhält ihren Lernfortschritt und bewahrt entfernte Quellkarten, bis du sie ausdrücklich bereinigst.",
    es: "Se reconocieron {0} tarjetas existentes. La actualización conserva su progreso y mantiene las tarjetas eliminadas del origen hasta que las limpies expresamente.",
    fr: "{0} cartes existantes ont été reconnues. La mise à jour conserve leur progression et garde les cartes retirées de la source jusqu’à leur nettoyage explicite.",
  },
  "import.generatedCard": {
    en: "generated card",
    de: "erzeugte Karte",
    es: "tarjeta generada",
    fr: "carte générée",
  },
  "import.generatedCards": {
    en: "generated cards",
    de: "erzeugte Karten",
    es: "tarjetas generadas",
    fr: "cartes générées",
  },
  "import.preparedSummary": {
    en: "{0} decks, {1} cards and {2} media files · {3} · {4}",
    de: "{0} Lernsets, {1} Karten und {2} Mediendateien · {3} · {4}",
    es: "{0} mazos, {1} tarjetas y {2} archivos multimedia · {3} · {4}",
    fr: "{0} paquets, {1} cartes et {2} fichiers multimédias · {3} · {4}",
  },
  "import.updatePreservesProgress": {
    en: "The existing collection will be updated and its learning progress preserved.",
    de: "Die vorhandene Sammlung wird aktualisiert und ihr Lernfortschritt bleibt erhalten.",
    es: "La colección existente se actualizará y conservará su progreso de aprendizaje.",
    fr: "La collection existante sera mise à jour et sa progression sera conservée.",
  },
  "music.practiceStartSet": {
    en: "Set practice start A, {0}",
    de: "Übungsanfang A setzen, {0}",
    es: "Fijar el inicio de práctica A, {0}",
    fr: "Définir le début de l’exercice A, {0}",
  },
  "music.practiceStartClear": {
    en: "Clear practice start A, {0}",
    de: "Übungsanfang A löschen, {0}",
    es: "Borrar el inicio de práctica A, {0}",
    fr: "Effacer le début de l’exercice A, {0}",
  },
  "music.practiceEndSet": {
    en: "Set practice end B, {0}",
    de: "Übungsende B setzen, {0}",
    es: "Fijar el final de práctica B, {0}",
    fr: "Définir la fin de l’exercice B, {0}",
  },
  "music.practiceEndClear": {
    en: "Clear practice end B, {0}",
    de: "Übungsende B löschen, {0}",
    es: "Borrar el final de práctica B, {0}",
    fr: "Effacer la fin de l’exercice B, {0}",
  },
  "study.selectedDeck": {
    en: "Selected deck",
    de: "Ausgewähltes Lernset",
    es: "Mazo seleccionado",
    fr: "Paquet sélectionné",
  },
  "study.selectedReference": {
    en: "Selected reference",
    de: "Ausgewählte Referenz",
    es: "Referencia seleccionada",
    fr: "Référence sélectionnée",
  },
  "study.currentCardDeck": {
    en: "Current card deck",
    de: "Lernset der aktuellen Karte",
    es: "Mazo de la tarjeta actual",
    fr: "Paquet de la carte actuelle",
  },
  "study.currentReferenceDeck": {
    en: "Current reference deck",
    de: "Referenz der aktuellen Karte",
    es: "Referencia de la tarjeta actual",
    fr: "Référence de la carte actuelle",
  },
  "study.currentDeck": {
    en: "Current deck",
    de: "Aktuelles Lernset",
    es: "Mazo actual",
    fr: "Paquet actuel",
  },
  "study.currentReference": {
    en: "Current reference",
    de: "Aktuelle Referenz",
    es: "Referencia actual",
    fr: "Référence actuelle",
  },
  "study.completePractice": {
    en: "All cards were practised without changing your progress.",
    de: "Alle Karten wurden geübt, ohne deinen Fortschritt zu verändern.",
    es: "Has practicado todas las tarjetas sin modificar tu progreso.",
    fr: "Toutes les cartes ont été travaillées sans modifier votre progression.",
  },
  "study.completeToday": {
    en: "Everything is reviewed for today.",
    de: "Für heute ist alles bearbeitet.",
    es: "Has terminado todos los repasos de hoy.",
    fr: "Toutes les révisions du jour sont terminées.",
  },
  "strategy.hidePace": {
    en: "Hide learning pace details",
    de: "Lerntempo-Details ausblenden",
    es: "Ocultar los detalles del ritmo de aprendizaje",
    fr: "Masquer les détails du rythme d’apprentissage",
  },
  "strategy.showPace": {
    en: "Show learning pace details",
    de: "Lerntempo-Details anzeigen",
    es: "Mostrar los detalles del ritmo de aprendizaje",
    fr: "Afficher les détails du rythme d’apprentissage",
  },
  "fileExport.nativeShareUnavailable": {
    en: "The system share sheet is unavailable. Update Flash-n-Flip on this device.",
    de: "Der Teilen-Dialog des Systems ist nicht verfügbar. Aktualisiere Flash-n-Flip auf diesem Gerät.",
    es: "La hoja para compartir del sistema no está disponible. Actualiza Flash-n-Flip en este dispositivo.",
    fr: "La feuille de partage du système n’est pas disponible. Mettez à jour Flash-n-Flip sur cet appareil.",
  },
  "fileExport.unsupported": {
    en: "This device cannot pass the FNF package to the system share sheet.",
    de: "Dieses Gerät kann das FNF-Paket nicht an den Teilen-Dialog des Systems übergeben.",
    es: "Este dispositivo no puede enviar el paquete FNF a la hoja para compartir del sistema.",
    fr: "Cet appareil ne peut pas transmettre le paquet FNF à la feuille de partage du système.",
  },
  "content.error.display": {
    en: "This card cannot be displayed.",
    de: "Diese Karte kann nicht angezeigt werden.",
    es: "Esta tarjeta no se puede mostrar.",
    fr: "Cette carte ne peut pas être affichée.",
  },
  "content.cloze.blank": {
    en: "Blank",
    de: "Lücke",
    es: "Hueco",
    fr: "Texte à trous",
  },
  "content.cloze.blankHint": {
    en: "Blank, hint: {0}",
    de: "Lücke, Hinweis: {0}",
    es: "Hueco, pista: {0}",
    fr: "Texte à trous, indice : {0}",
  },
  "editor.error.deckConflict": {
    en: "This deck changed on another device. Reload it before saving again.",
    de: "Dieses Lernset wurde auf einem anderen Gerät geändert. Lade es neu, bevor du erneut speicherst.",
    es: "Este mazo ha cambiado en otro dispositivo. Vuelve a cargarlo antes de guardarlo de nuevo.",
    fr: "Ce paquet a été modifié sur un autre appareil. Rechargez-le avant de l’enregistrer à nouveau.",
  },
  "editor.error.cardConflict": {
    en: "This card changed on another device. Reload it before saving again.",
    de: "Diese Karte wurde auf einem anderen Gerät geändert. Lade sie neu, bevor du erneut speicherst.",
    es: "Esta tarjeta ha cambiado en otro dispositivo. Vuelve a cargarla antes de guardarla de nuevo.",
    fr: "Cette carte a été modifiée sur un autre appareil. Rechargez-la avant de l’enregistrer à nouveau.",
  },
  "editor.error.sessionExpired": {
    en: "Your session has expired. Sign in again.",
    de: "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
    es: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    fr: "Votre session a expiré. Reconnectez-vous.",
  },
  "editor.error.invalidChanges": {
    en: "The changes are invalid. Check the entered content.",
    de: "Die Änderungen sind ungültig. Prüfe die eingegebenen Inhalte.",
    es: "Los cambios no son válidos. Comprueba el contenido introducido.",
    fr: "Les modifications ne sont pas valides. Vérifiez le contenu saisi.",
  },
  "editor.error.serverSave": {
    en: "The server could not save the changes. Please try again.",
    de: "Der Server konnte die Änderungen nicht speichern. Bitte versuche es erneut.",
    es: "El servidor no pudo guardar los cambios. Inténtalo de nuevo.",
    fr: "Le serveur n’a pas pu enregistrer les modifications. Réessayez.",
  },
  "editor.error.connection": {
    en: "The connection failed. Check your network and try again.",
    de: "Die Verbindung ist fehlgeschlagen. Prüfe dein Netzwerk und versuche es erneut.",
    es: "La conexión ha fallado. Comprueba tu red e inténtalo de nuevo.",
    fr: "La connexion a échoué. Vérifiez votre réseau et réessayez.",
  },
  "markdown.error.invalidPosition": {
    en: "Every numbered cloze needs its own position from 1 to 500. Remove duplicate position numbers.",
    de: "Jede nummerierte Lücke braucht eine eigene Position zwischen 1 und 500. Entferne doppelte Positionsnummern.",
    es: "Cada hueco numerado necesita una posición propia entre 1 y 500. Elimina los números de posición duplicados.",
    fr: "Chaque texte à trous numéroté doit avoir une position unique comprise entre 1 et 500. Supprimez les numéros en double.",
  },
  "markdown.error.emptyAnswer": {
    en: "A cloze is missing its correct answer.",
    de: "Eine Lücke enthält keine richtige Antwort.",
    es: "Falta la respuesta correcta en un hueco.",
    fr: "Une réponse correcte manque dans un texte à trous.",
  },
  "markdown.error.tooManyClozes": {
    en: "A card supports at most 500 clozes.",
    de: "Eine Karte darf höchstens 500 Lücken enthalten.",
    es: "Una tarjeta admite como máximo 500 huecos.",
    fr: "Une carte peut contenir au maximum 500 textes à trous.",
  },
  "markdown.error.invalidRowspan": {
    en: "::: must continue one cell directly above with the same column span.",
    de: "::: muss eine Zelle direkt darüber mit derselben Spaltenbreite fortsetzen.",
    es: "::: debe continuar una celda situada directamente encima con la misma extensión de columnas.",
    fr: "::: doit prolonger une cellule située juste au-dessus avec la même étendue de colonnes.",
  },
  "markdown.error.tooManyRows": {
    en: "A side heading can span at most 500 rows.",
    de: "Eine seitliche Überschrift darf höchstens 500 Zeilen verbinden.",
    es: "Un encabezado lateral puede abarcar como máximo 500 filas.",
    fr: "Un en-tête latéral peut couvrir au maximum 500 lignes.",
  },
  "markdown.error.invalid": {
    en: "The cloze text is invalid. Check braces, answer choices, and +N.",
    de: "Der Lückentext ist ungültig. Prüfe geschweifte Klammern, Antwortvorschläge und +N.",
    es: "El texto con huecos no es válido. Comprueba las llaves, las opciones de respuesta y +N.",
    fr: "Le texte à trous n’est pas valide. Vérifiez les accolades, les choix de réponse et +N.",
  },
  "rich.mermaid.timeout": {
    en: "The diagram took too long to render.",
    de: "Das Diagramm brauchte zu lange zum Rendern.",
    es: "El diagrama tardó demasiado en renderizarse.",
    fr: "Le rendu du diagramme a pris trop de temps.",
  },
  "rich.mermaid.failed": {
    en: "The diagram could not be rendered safely.",
    de: "Das Diagramm konnte nicht sicher gerendert werden.",
    es: "El diagrama no se pudo renderizar de forma segura.",
    fr: "Le diagramme n’a pas pu être rendu de manière sûre.",
  },
  "rich.mermaid.description": {
    en: "Description of the diagram and its most important relationships.",
    de: "Beschreibung des Diagramms und seiner wichtigsten Beziehungen.",
    es: "Descripción del diagrama y de sus relaciones más importantes.",
    fr: "Description du diagramme et de ses relations les plus importantes.",
  },
  "rich.mermaid.name.flowchart": {
    en: "Flowchart",
    de: "Flussdiagramm",
    es: "Diagrama de flujo",
    fr: "Organigramme",
  },
  "rich.mermaid.name.sequence": {
    en: "Sequence diagram",
    de: "Sequenzdiagramm",
    es: "Diagrama de secuencia",
    fr: "Diagramme de séquence",
  },
  "rich.mermaid.name.state": {
    en: "State diagram",
    de: "Zustandsdiagramm",
    es: "Diagrama de estados",
    fr: "Diagramme d’états",
  },
  "rich.mermaid.name.class": {
    en: "Class diagram",
    de: "Klassendiagramm",
    es: "Diagrama de clases",
    fr: "Diagramme de classes",
  },
  "rich.mermaid.name.er": {
    en: "Entity relationship diagram",
    de: "ER-Diagramm",
    es: "Diagrama entidad-relación",
    fr: "Diagramme entité-association",
  },
  "rich.mermaid.name.mindmap": {
    en: "Mind map",
    de: "Mindmap",
    es: "Mapa mental",
    fr: "Carte mentale",
  },
  "rich.mermaid.name.timeline": {
    en: "Timeline",
    de: "Zeitleiste",
    es: "Línea de tiempo",
    fr: "Chronologie",
  },
  "rich.jsxGraph.timeout": {
    en: "The interactive graph took too long to render.",
    de: "Der interaktive Graph brauchte zu lange zum Rendern.",
    es: "El gráfico interactivo tardó demasiado en renderizarse.",
    fr: "Le rendu du graphique interactif a pris trop de temps.",
  },
  "rich.jsxGraph.failed": {
    en: "The interactive graph could not be rendered safely.",
    de: "Der interaktive Graph konnte nicht sicher gerendert werden.",
    es: "El gráfico interactivo no se pudo renderizar de forma segura.",
    fr: "Le graphique interactif n’a pas pu être rendu de manière sûre.",
  },
  "rich.jsxGraph.label": {
    en: "Interactive graph",
    de: "Interaktiver Graph",
    es: "Gráfico interactivo",
    fr: "Graphique interactif",
  },
  "rich.music.label": {
    en: "Music notation",
    de: "Notensatz",
    es: "Notación musical",
    fr: "Notation musicale",
  },
  "rich.music.clefs.both": {
    en: "treble and bass clefs",
    de: "Violin- und Bassschlüssel",
    es: "claves de sol y fa",
    fr: "clés de sol et de fa",
  },
  "rich.music.clefs.bass": {
    en: "bass clef",
    de: "Bassschlüssel",
    es: "clave de fa",
    fr: "clé de fa",
  },
  "rich.music.clefs.treble": {
    en: "treble clef",
    de: "Violinschlüssel",
    es: "clave de sol",
    fr: "clé de sol",
  },
  "rich.music.description": {
    en: "{0} musical events in {1} measures. Key {2}, {3}.",
    de: "{0} musikalische Ereignisse in {1} Takten. Tonart {2}, {3}.",
    es: "{0} eventos musicales en {1} compases. Tonalidad {2}, {3}.",
    fr: "{0} événements musicaux sur {1} mesures. Tonalité {2}, {3}.",
  },
  "rich.music.descriptionWithMeter": {
    en: "{0} musical events in {1} measures. Key {2}, meter {3}, {4}.",
    de: "{0} musikalische Ereignisse in {1} Takten. Tonart {2}, Taktart {3}, {4}.",
    es: "{0} eventos musicales en {1} compases. Tonalidad {2}, compás {3}, {4}.",
    fr: "{0} événements musicaux sur {1} mesures. Tonalité {2}, mesure {3}, {4}.",
  },
  "settings.audio.title": {
    en: "Local audio optimization",
    de: "Lokale Audiooptimierung",
    es: "Optimización de audio local",
    fr: "Optimisation audio locale",
  },
  "settings.audio.progress": {
    en: "Audio optimization progress",
    de: "Fortschritt der Audiooptimierung",
    es: "Progreso de la optimización de audio",
    fr: "Progression de l’optimisation audio",
  },
  "settings.audio.resumeCooling": {
    en: "Resume audio optimization automatically after cooling down",
    de: "Audiooptimierung nach Abkühlung automatisch fortsetzen",
    es: "Reanudar automáticamente la optimización de audio después de enfriarse",
    fr: "Reprendre automatiquement l’optimisation audio après refroidissement",
  },
  "settings.audio.resumeBattery": {
    en: "Resume audio optimization automatically when battery protection ends",
    de: "Audiooptimierung nach Ende des Batterieschutzes automatisch fortsetzen",
    es: "Reanudar automáticamente la optimización de audio al finalizar la protección de la batería",
    fr: "Reprendre automatiquement l’optimisation audio à la fin de la protection de la batterie",
  },
  "settings.audio.unavailable": {
    en: "Audio optimization is unavailable on this device",
    de: "Audiooptimierung ist auf diesem Gerät nicht verfügbar",
    es: "La optimización de audio no está disponible en este dispositivo",
    fr: "L’optimisation audio n’est pas disponible sur cet appareil",
  },
  "settings.audio.complete": {
    en: "Audio check complete",
    de: "Audioprüfung abgeschlossen",
    es: "Comprobación de audio completada",
    fr: "Vérification audio terminée",
  },
  "settings.audio.pause": {
    en: "Pause audio optimization",
    de: "Audiooptimierung pausieren",
    es: "Pausar la optimización de audio",
    fr: "Suspendre l’optimisation audio",
  },
  "settings.audio.start": {
    en: "Start audio optimization",
    de: "Audiooptimierung starten",
    es: "Iniciar la optimización de audio",
    fr: "Démarrer l’optimisation audio",
  },
  "settings.audio.checked": {
    en: "checked",
    de: "geprüft",
    es: "comprobados",
    fr: "vérifiés",
  },
  "settings.audio.optimized": {
    en: "optimized",
    de: "optimiert",
    es: "optimizados",
    fr: "optimisés",
  },
  "settings.languageSaved": {
    en: "Language preference saved.",
    de: "Spracheinstellung gespeichert.",
    es: "Preferencia de idioma guardada.",
    fr: "Préférence de langue enregistrée.",
  },
  "mediaEditor.title": {
    en: "Media",
    de: "Medien",
    es: "Multimedia",
    fr: "Médias",
  },
  "editor.linkedCompact": {
    en: "Linked",
    de: "Verknüpft",
    es: "Vinculada",
    fr: "Liée",
  },
  "editor.noRatingCompact": {
    en: "Unrated",
    de: "Unbewertet",
    es: "Sin nota",
    fr: "Sans note",
  },
  "mediaEditor.localOnly": {
    en: "Images and audio stay local and are saved with the deck.",
    de: "Bilder und Audio bleiben lokal und werden mit dem Lernset gespeichert.",
    es: "Las imágenes y el audio permanecen locales y se guardan con el mazo.",
    fr: "Les images et les fichiers audio restent locaux et sont enregistrés avec le paquet.",
  },
  "mediaEditor.insertReference": {
    en: "Insert media at the current cursor position",
    de: "Medium an der aktuellen Cursorposition einfügen",
    es: "Insertar el medio en la posición actual del cursor",
    fr: "Insérer le média à la position actuelle du curseur",
  },
  "mediaEditor.edit": {
    en: "Edit",
    de: "Bearbeiten",
    es: "Editar",
    fr: "Modifier",
  },
  "study.answerSplit": {
    en: "Resize question and answer",
    de: "Höhenverhältnis von Frage und Antwort ändern",
    es: "Cambiar la altura de la pregunta y la respuesta",
    fr: "Modifier la hauteur de la question et de la réponse",
  },
  "mediaEditor.addImage": {
    en: "Add image",
    de: "Bild hinzufügen",
    es: "Añadir imagen",
    fr: "Ajouter une image",
  },
  "mediaEditor.camera": {
    en: "Camera",
    de: "Kamera",
    es: "Cámara",
    fr: "Appareil photo",
  },
  "mediaEditor.addAudio": {
    en: "Add audio",
    de: "Audio hinzufügen",
    es: "Añadir audio",
    fr: "Ajouter un fichier audio",
  },
  "mediaEditor.record": {
    en: "Record",
    de: "Aufnehmen",
    es: "Grabar",
    fr: "Enregistrer",
  },
  "mediaEditor.stopRecording": {
    en: "Stop recording",
    de: "Aufnahme stoppen",
    es: "Detener grabación",
    fr: "Arrêter l’enregistrement",
  },
  "mediaEditor.processing": {
    en: "Validating and processing media …",
    de: "Medium wird geprüft und verarbeitet …",
    es: "Validando y procesando el archivo multimedia…",
    fr: "Validation et traitement du média…",
  },
  "mediaEditor.empty": {
    en: "No image or audio on this card side.",
    de: "Kein Bild oder Audio auf dieser Kartenseite.",
    es: "No hay imágenes ni audio en esta cara de la tarjeta.",
    fr: "Aucune image ni aucun fichier audio sur cette face de la carte.",
  },
  "mediaEditor.altText": {
    en: "Alternative text",
    de: "Alternativtext",
    es: "Texto alternativo",
    fr: "Texte alternatif",
  },
  "mediaEditor.decorative": {
    en: "Decorative image",
    de: "Dekoratives Bild",
    es: "Imagen decorativa",
    fr: "Image décorative",
  },
  "mediaEditor.crop": {
    en: "Crop ratio",
    de: "Zuschnitt",
    es: "Proporción de recorte",
    fr: "Format de recadrage",
  },
  "mediaEditor.cropOriginal": {
    en: "Original",
    de: "Original",
    es: "Original",
    fr: "Original",
  },
  "mediaEditor.rotateLeft": {
    en: "Rotate image left",
    de: "Bild nach links drehen",
    es: "Girar imagen a la izquierda",
    fr: "Faire pivoter l’image vers la gauche",
  },
  "mediaEditor.rotateRight": {
    en: "Rotate image right",
    de: "Bild nach rechts drehen",
    es: "Girar imagen a la derecha",
    fr: "Faire pivoter l’image vers la droite",
  },
  "mediaEditor.applyCrop": {
    en: "Apply crop",
    de: "Zuschnitt anwenden",
    es: "Aplicar recorte",
    fr: "Appliquer le recadrage",
  },
  "mediaEditor.editImage": {
    en: "Edit image",
    de: "Bild bearbeiten",
    es: "Editar imagen",
    fr: "Modifier l’image",
  },
  "mediaEditor.cropDialogTitle": {
    en: "Crop image",
    de: "Bild zuschneiden",
    es: "Recortar imagen",
    fr: "Recadrer l’image",
  },
  "mediaEditor.cropInstructions": {
    en: "Move the frame and drag its corners. Precise controls are available below.",
    de: "Rahmen verschieben und an den Ecken ziehen. Darunter stehen genaue Regler bereit.",
    es: "Mueve el marco y arrastra sus esquinas. Debajo hay controles precisos.",
    fr: "Déplacez le cadre et tirez ses coins. Des réglages précis sont disponibles dessous.",
  },
  "mediaEditor.cropPreset": {
    en: "Aspect ratio",
    de: "Seitenverhältnis",
    es: "Proporción",
    fr: "Format",
  },
  "mediaEditor.cropHorizontal": {
    en: "Horizontal position",
    de: "Horizontale Position",
    es: "Posición horizontal",
    fr: "Position horizontale",
  },
  "mediaEditor.cropVertical": {
    en: "Vertical position",
    de: "Vertikale Position",
    es: "Posición vertical",
    fr: "Position verticale",
  },
  "mediaEditor.cropWidth": {
    en: "Width",
    de: "Breite",
    es: "Anchura",
    fr: "Largeur",
  },
  "mediaEditor.cropHeight": {
    en: "Height",
    de: "Höhe",
    es: "Altura",
    fr: "Hauteur",
  },
  "mediaEditor.cropReset": {
    en: "Reset",
    de: "Zurücksetzen",
    es: "Restablecer",
    fr: "Réinitialiser",
  },
  "mediaEditor.cropCancel": {
    en: "Cancel",
    de: "Abbrechen",
    es: "Cancelar",
    fr: "Annuler",
  },
  "mediaEditor.cropApply": {
    en: "Apply",
    de: "Übernehmen",
    es: "Aplicar",
    fr: "Appliquer",
  },
  "mediaEditor.audioLabel": {
    en: "Audio label",
    de: "Audiobeschriftung",
    es: "Etiqueta del audio",
    fr: "Libellé audio",
  },
  "mediaEditor.transcript": {
    en: "Transcript (optional)",
    de: "Transkript (optional)",
    es: "Transcripción (opcional)",
    fr: "Transcription (facultative)",
  },
  "mediaEditor.trimStart": {
    en: "Start (seconds)",
    de: "Start (Sekunden)",
    es: "Inicio (segundos)",
    fr: "Début (secondes)",
  },
  "mediaEditor.trimEnd": {
    en: "End (seconds)",
    de: "Ende (Sekunden)",
    es: "Fin (segundos)",
    fr: "Fin (secondes)",
  },
  "mediaEditor.trim": {
    en: "Trim audio",
    de: "Audio zuschneiden",
    es: "Recortar audio",
    fr: "Découper l’audio",
  },
  "mediaEditor.replace": {
    en: "Replace media",
    de: "Medium ersetzen",
    es: "Reemplazar archivo multimedia",
    fr: "Remplacer le média",
  },
  "mediaEditor.moveUp": {
    en: "Move media up",
    de: "Medium nach oben verschieben",
    es: "Mover archivo multimedia hacia arriba",
    fr: "Déplacer le média vers le haut",
  },
  "mediaEditor.moveDown": {
    en: "Move media down",
    de: "Medium nach unten verschieben",
    es: "Mover archivo multimedia hacia abajo",
    fr: "Déplacer le média vers le bas",
  },
  "mediaEditor.remove": {
    en: "Remove media",
    de: "Medium entfernen",
    es: "Eliminar archivo multimedia",
    fr: "Supprimer le média",
  },
  "mediaEditor.error.empty": {
    en: "The selected file is empty.",
    de: "Die ausgewählte Datei ist leer.",
    es: "El archivo seleccionado está vacío.",
    fr: "Le fichier sélectionné est vide.",
  },
  "mediaEditor.error.tooLarge": {
    en: "The file is too large. Images are limited to 15 MB and audio to 50 MB.",
    de: "Die Datei ist zu groß. Bilder sind auf 15 MB und Audio auf 50 MB begrenzt.",
    es: "El archivo es demasiado grande. Las imágenes están limitadas a 15 MB y el audio a 50 MB.",
    fr: "Le fichier est trop volumineux. Les images sont limitées à 15 Mo et l’audio à 50 Mo.",
  },
  "mediaEditor.error.unsupported": {
    en: "The file signature is not a supported image or audio format.",
    de: "Die Dateisignatur gehört zu keinem unterstützten Bild- oder Audioformat.",
    es: "La firma del archivo no corresponde a un formato de imagen o audio compatible.",
    fr: "La signature du fichier ne correspond à aucun format d’image ou audio pris en charge.",
  },
  "mediaEditor.error.mimeMismatch": {
    en: "The declared file type does not match its content.",
    de: "Der angegebene Dateityp stimmt nicht mit dem Inhalt überein.",
    es: "El tipo de archivo declarado no coincide con su contenido.",
    fr: "Le type de fichier déclaré ne correspond pas à son contenu.",
  },
  "mediaEditor.error.decode": {
    en: "The media file could not be decoded safely.",
    de: "Die Mediendatei konnte nicht sicher dekodiert werden.",
    es: "El archivo multimedia no se pudo decodificar de forma segura.",
    fr: "Le fichier multimédia n’a pas pu être décodé de manière sûre.",
  },
  "mediaEditor.error.microphone": {
    en: "Microphone recording is unavailable or was not permitted.",
    de: "Die Mikrofonaufnahme ist nicht verfügbar oder wurde nicht erlaubt.",
    es: "La grabación con micrófono no está disponible o no se ha permitido.",
    fr: "L’enregistrement au microphone n’est pas disponible ou n’a pas été autorisé.",
  },
  "mediaEditor.altRequired": {
    en: "Add alternative text or mark the image as decorative.",
    de: "Füge einen Alternativtext hinzu oder markiere das Bild als dekorativ.",
    es: "Añade texto alternativo o marca la imagen como decorativa.",
    fr: "Ajoutez un texte alternatif ou marquez l’image comme décorative.",
  },
} as const;

export const uiMessages = {
  ...semanticUiMessages,
  ...generatedUiMessages,
} as const;
export type UiMessageKey = keyof typeof uiMessages;

export function isLocale(value: unknown): value is Locale {
  return supportedLocales.includes(value as Locale);
}

/**
 * Legacy adapter for the separately deployed administration console, whose
 * language switcher intentionally exposes only English and German. Product UI
 * code must use `translateUi` with a typed `UiMessageKey` instead.
 */
export function selectTranslation(
  locale: Locale,
  english: string,
  german: string,
  spanish = english,
  french = english,
): string {
  return { en: english, de: german, es: spanish, fr: french }[locale];
}

export function isUiMessageKey(value: string): value is UiMessageKey {
  return Object.hasOwn(uiMessages, value);
}

export type UiMessageValue = string | number;

export function translateUiMessage(
  locale: Locale,
  key: UiMessageKey,
  values: readonly UiMessageValue[] = [],
): string {
  const message = uiMessages[key][locale];
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? placeholder : String(value);
  });
}

export function translate<
  Section extends keyof typeof en,
  Key extends keyof (typeof en)[Section],
>(locale: Locale, section: Section, key: Key): string {
  const selected: TranslationShape = translations[locale];
  return selected[section][key];
}
