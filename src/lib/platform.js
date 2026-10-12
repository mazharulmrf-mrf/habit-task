// Native (Capacitor) vs web/desktop bridge. App code never touches Capacitor directly.
import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const isNative = () => Capacitor.isNativePlatform()
export const isElectron = () => typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)

/* ---------- Fingerprint ---------- */
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n))
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer
const BIO_KEY = 'study2do.bio' // same key as before, do not rename

export async function bioAvailable() {
  if (isNative()) {
    try { return (await BiometricAuth.checkBiometry()).isAvailable } catch { return false }
  }
  if (isElectron()) return false // desktop: PIN only
  try {
    return !!(window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()))
  } catch { return false }
}

// Resolves on success, rejects on failure/cancel.
export async function bioEnroll() {
  if (isNative()) {
    await BiometricAuth.authenticate({
      reason: 'Turn on fingerprint unlock',
      cancelTitle: 'Cancel',
      androidTitle: 'Habit-Task',
      androidSubtitle: 'Turn on fingerprint unlock'
    })
    localStorage.setItem(BIO_KEY, 'native')
    return true
  }
  const c = await navigator.credentials.create({
    publicKey: {
      challenge: rnd(32),
      rp: { name: 'Habit-Task' },
      user: { id: rnd(16), name: 'tickly', displayName: 'Habit-Task' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000
    }
  })
  localStorage.setItem(BIO_KEY, b64(c.rawId))
  return true
}

export async function bioAsk() {
  const v = localStorage.getItem(BIO_KEY)
  if (!v) throw new Error('not enrolled')
  if (isNative()) {
    await BiometricAuth.authenticate({
      reason: 'Unlock Habit-Task',
      cancelTitle: 'Use PIN',
      androidTitle: 'Habit-Task',
      androidSubtitle: 'Unlock with fingerprint'
    })
    return true
  }
  await navigator.credentials.get({
    publicKey: {
      challenge: rnd(32),
      userVerification: 'required',
      timeout: 60000,
      allowCredentials: [{ type: 'public-key', id: unb64(v), transports: ['internal'] }]
    }
  })
  return true
}

/* ---------- Task reminder ---------- */
const notifId = (s) => {
  let h = 0
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) % 2147483647 || 1
}
const timers = new Map()

export async function scheduleReminder(task, atDate) {
  if (!task || atDate <= new Date()) return
  if (isNative()) {
    const p = await LocalNotifications.requestPermissions()
    if (p.display !== 'granted') return
    await LocalNotifications.schedule({
      notifications: [{
        id: notifId(task.id),
        title: task.n,
        body: 'Time for your task',
        schedule: { at: atDate, allowWhileIdle: true }
      }]
    })
    return
  }
  // web/desktop: works while the app is open
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission !== 'granted') return
  const delay = atDate - new Date()
  if (delay > 2147483647) return
  timers.set(task.id, setTimeout(() => {
    new Notification(task.n, { body: 'Time for your task' })
    timers.delete(task.id)
  }, delay))
}

export async function cancelReminder(task) {
  if (!task) return
  if (isNative()) {
    try { await LocalNotifications.cancel({ notifications: [{ id: notifId(task.id) }] }) } catch { /* ignore */ }
    return
  }
  clearTimeout(timers.get(task.id))
  timers.delete(task.id)
}

/* ---------- Backup ---------- */
// Resolves 'share' (native) or 'download' (web/desktop). Rejects on real errors.
export async function saveBackup(json, name) {
  if (isNative()) {
    const r = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: 'Habit-Task backup', url: r.uri })
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) throw e
    }
    return 'share'
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
  return 'download'
}
