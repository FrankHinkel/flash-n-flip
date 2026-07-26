# Mobile Release

## Lokaler iPhone-Simulator

Die vollständige Entwicklungsumgebung wird mit `./flashStart.sh` gestartet.
Das Skript bindet die lokale API im Entwicklungsmodus an das LAN und übergibt
Expo die erreichbare Host-Adresse. Expo Go darf deshalb nicht mit einer
gespeicherten `127.0.0.1`- oder alten Port-URL geöffnet werden.

Alternativ startet der folgende Befehl Expo gezielt im bereits gebooteten
iPhone-Simulator:

```bash
pnpm mobile:ios
```

Der Befehl verwendet LAN-Modus, Port 8081 und einen leeren Metro-Cache. In der
Entwicklung ersetzt die App eine konfigurierte Loopback-API automatisch durch
den Host aus dem aktuellen Expo-Manifest. Eine explizite Remote-API und
Produktionsbuilds werden nicht umgeschrieben.

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
