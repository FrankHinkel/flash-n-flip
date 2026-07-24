# Mobile Release

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
