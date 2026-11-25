import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Baustellenplaner',
        short_name: 'Baustelle',
        description: 'Termine, Angebote und Aufgaben für Umbau und Zubau',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#edf0f2',
        theme_color: '#16212e',
        // PNGs are rendered from public/icon.svg; iOS and older Android launchers ignore SVG icons.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Only cache the app shell. Data (AppSync) and signed S3 URLs
        // always go to the network - a cache would serve expired signatures.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
