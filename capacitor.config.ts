import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.maruf.tickly', // Play Store-e publish korle ar kokhono bodlano jay na
  appName: 'Habit-Task',
  webDir: 'dist',
  plugins: {
    LocalNotifications: { iconColor: '#111111' }
  }
}
export default config
