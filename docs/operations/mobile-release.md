# Mobile Release

## Lokaler iPhone-Simulator

Die vollständige Entwicklungsumgebung wird mit `./flashStart.sh` gestartet.
Das Skript bindet die lokale API im Entwicklungsmodus an das LAN und übergibt
Expo die erreichbare Host-Adresse über `EXPO_PUBLIC_API_URL`. Ohne diese
explizite Entwicklungsvariable verwendet die native App aus Sicherheitsgründen
die produktive API `https://flash-n-flip.com/api`; ein Release-Build darf nie
auf die Loopback-Adresse des iPhones zeigen.

Alternativ startet der folgende Befehl Expo gezielt im bereits gebooteten
iPhone-Simulator:

```bash
pnpm mobile:ios
```

Der Befehl verwendet LAN-Modus, Port 8081 und einen leeren Metro-Cache. Für die
lokale API muss vorher `./flashStart.sh` laufen oder eine vom iPhone erreichbare
`EXPO_PUBLIC_API_URL` gesetzt sein. Eine explizite Remote-API wird nicht
umgeschrieben.

Ein direkt auf einem registrierten iPhone installierbarer Release-Build wird
mit der produktiven API und dem Bundle-Identifier `com.flash-n-flip` erzeugt:

```bash
EXPO_PUBLIC_API_URL=https://flash-n-flip.com/api \
  pnpm --filter @flashcards/mobile exec expo run:ios \
  --device --configuration Release
```

## Voraussetzungen

- Apple Developer Team und App-Store-Connect-App
- Google Play Console App
- Expo-Konto und gesetzte `eas.projectId`
- produktive `EXPO_PUBLIC_API_URL`
- Signierungsrechte im CI- oder EAS-Projekt

## Reproduzierbarer Ablauf

```bash
pnpm install --frozen-lockfile
pnpm --filter @flashcards/mobile typecheck
pnpm --filter @flashcards/mobile exec expo install --check
pnpm --filter @flashcards/mobile exec eas build --platform ios --profile production
pnpm --filter @flashcards/mobile exec eas build --platform android --profile production
```

EAS erzeugt dabei aus `apps/mobile` ein signiertes `.ipa` für iOS und ein
`.aab` für Android. Preview-Builds werden vor dem Store-Upload auf der
Gerätematrix getestet. Der Store-Upload erfolgt erst nach bestandenem
Release-Gate und abgeschlossener rechtlicher Prüfung.

## Store-Einreichung

```bash
pnpm --filter @flashcards/mobile exec eas submit --platform ios
pnpm --filter @flashcards/mobile exec eas submit --platform android
```

Store-Metadaten, Datenschutzangaben, Screenshots, Altersfreigabe und
Support-URLs werden vor jeder Einreichung im Vier-Augen-Prinzip geprüft.
