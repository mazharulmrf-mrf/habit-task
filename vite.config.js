import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Three builds from one config:  web (PWA) | android (default) | desktop
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : (process.env.VITE_BASE || '/'),
  build: { outDir: mode === 'desktop' ? 'dist-desktop' : 'dist' },
  plugins: [
    ...(mode === 'web'
      ? [VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'fonts/*.woff2'],
          manifest: {
            name: 'Habit-Task',
            short_name: 'Habit-Task',
            description: 'Habits and tasks in one place',
            display: 'standalone',
            background_color: '#0e0e0d',
            theme_color: '#0e0e0d',
            icons: [
              { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          }
        })]
      : [])
  ]
}))
