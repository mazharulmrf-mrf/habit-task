// Runs after every `cap sync`. Safe to run many times.
// 1) exact-alarm permission so reminders fire on time
// 2) app name on the phone (Capacitor does not update it after first `cap add`)
import fs from 'node:fs'

const APP_NAME = 'Habit-Task'

const manifest = 'android/app/src/main/AndroidManifest.xml'
if (fs.existsSync(manifest)) {
  let x = fs.readFileSync(manifest, 'utf8')
  if (!x.includes('SCHEDULE_EXACT_ALARM')) {
    x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />\n</manifest>')
    fs.writeFileSync(manifest, x)
    console.log('Manifest patched')
  }
}

const strings = 'android/app/src/main/res/values/strings.xml'
if (fs.existsSync(strings)) {
  let s = fs.readFileSync(strings, 'utf8')
  const n = s
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${APP_NAME}$2`)
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${APP_NAME}$2`)
  if (n !== s) { fs.writeFileSync(strings, n); console.log('App name set to ' + APP_NAME) }
}
