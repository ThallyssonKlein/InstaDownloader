# InstaDownloader

App React Native (sem Expo) que baixa posts, reels, carrosséis e stories do
Instagram usando a [HikerAPI](https://hiker-doc.readthedocs.io/en/latest/) e salva
na galeria, no álbum "InstaDownloader".

## Requisitos (Linux / Android)

- Node >= 22.11
- JDK 17 (`JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`)
- Android SDK em `~/Android/Sdk` com platform 37, build-tools 37 e NDK 27.1.12297006
- `ANDROID_HOME` e `platform-tools`/`emulator` no `PATH`

## Rodando

```bash
npm install
npm start                 # Metro bundler (deixe aberto)
npm run android           # em outro terminal: compila e instala no emulador/celular
```

Emulador: `emulator -avd Pixel_6`. Celular físico: ative a depuração USB e
confira com `adb devices`.

A chave da HikerAPI vem do `.env` (fora do git), lido pelo
`react-native-dotenv` e embutido no bundle no momento do build:

```bash
cp .env.example .env   # e preencha HIKER_API_KEY
```

Depois de mudar o `.env`, reinicie o Metro com cache limpo: `npm start -- --reset-cache`.

## APK

```bash
cd android && ./gradlew assembleRelease
# saída: android/app/build/outputs/apk/release/app-release.apk
```

O template assina o release com a chave de debug; para publicar na Play Store,
gere sua própria keystore: https://reactnative.dev/docs/signed-apk-android

## Estrutura

- `App.tsx`: tela (link → buscar → preview → baixar)
- `src/api.ts`: cliente da HikerAPI (posts, reels, carrosséis, stories e destaques)
- `src/download.ts`: permissões, download para o cache e cópia para a galeria
- `.env`: `HIKER_API_KEY` (copie de `.env.example`)
