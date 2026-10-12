# Tickly (Web + Android + Desktop)

Ek-i code theke tinta version. Apnar Tickly.html-er UI/logic hubohu ache; shudhu fingerprint, backup share ar task reminder native/web-er jonno `src/lib/platform.js` diye alada kora.
localStorage key (`study2do.v1`, `.pin`, `.bio`) bodlano hoyni, tai purono data/backup kaj korbe.

## 1. Prothombar setup (PC-te)
```bash
npm install
npm i vite vite-plugin-pwa electron electron-builder @capacitor/cli @capacitor/assets --save-dev
npm i @capacitor/core @capacitor/android @capacitor/local-notifications @capacitor/filesystem @capacitor/share @aparajita/capacitor-biometric-auth
npx cap add android
npm run icons
```
(Prothom `npm install` e kichu hobe na, tarpor porer duita command-e sob package ashbe.)

## 2. Phone-e age test (Wi-Fi, android build chhara)
```bash
npm run dev
```
Terminal-e dewa `Network:` link phone-er Chrome-e kholo (PC ar phone ek Wi-Fi-te).

## 3. Phone-e asol app (USB)
Phone-e USB debugging on kore PC-te lagao, `adb devices` e phone dekhale:
```bash
npm run android:run
```
Othoba `npm run android:open` diye Android Studio-te Run.

## 4. APK banano
```bash
npm run android:apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk` (phone-e pathiye install korte parbe).

## 5. Web
```bash
npm run build:web
```
`dist/` folder Netlify/GitHub Pages-e upload koro. PWA hishebe phone/PC-te install kora jay.

## 6. Desktop
```bash
npm run desktop:dev      # test
npm run desktop:build    # installer -> release/
```
Windows-e .exe, macOS-er dmg macOS-e-i banate hoy, Linux-er AppImage/deb Linux-e. Tai GitHub Actions use koro.

## 7. GitHub Actions (auto build)
Code GitHub-e push korle `.github/workflows` er 3 ta workflow chole:
- `web.yml` -> GitHub Pages (Settings > Pages > Source: GitHub Actions)
- `android.yml` -> Actions > run > Artifacts theke `tickly-debug-apk`
- `desktop.yml` -> Win/Mac/Linux installer artifact

## Mone rekho
- `package.json`-e `author`-er email bodlao (Linux .deb-er jonno lage).
- Font: `public/fonts/` e `instrument-sans-latin-500/600/700-normal.woff2` ar `hanken-grotesk-latin-400/500/600-normal.woff2` rakho. Na dile system font cholbe.
- `appId` (`com.maruf.tickly`) Play Store-e publish korle ar bodlano jay na. Purono Study2do app-er upor update dite chaile oi app-er hubohu appId ar keystore lagbe.
- Debug APK Play Store-e dewa jay na. Play Store-er jonno signed release (.aab) alada step.
- Fingerprint: Android-e native, web-e WebAuthn, desktop-e shudhu PIN.
- Reminder: Android-e app bondho thakleo bajbe (Android 12+ e "Alarms & reminders" permission lagte pare). Web/desktop-e app khola thakle.
"# habit-task" 
