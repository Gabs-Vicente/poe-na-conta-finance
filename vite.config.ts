import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const pwaOfflineBundlePlugin = (): Plugin => ({
  name: 'poe-na-conta-pwa-offline',
  closeBundle() {
    const distDir = path.resolve(process.cwd(), 'dist')
    const swPath = path.join(distDir, 'sw.js')
    const assetsDir = path.join(distDir, 'assets')
    if (!fs.existsSync(swPath) || !fs.existsSync(assetsDir)) return
    const assetFiles = fs
      .readdirSync(assetsDir)
      .filter(file => /\.(js|css|svg|png|woff2?)$/i.test(file))
      .map(file => `'./assets/${file}'`)
    const swContent = fs.readFileSync(swPath, 'utf-8')
    fs.writeFileSync(
      swPath,
      swContent.replace('/*__VITE_PRECACHE_ASSETS__*/', assetFiles.join(',\n  ')),
      'utf-8',
    )
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  plugins: [react(), pwaOfflineBundlePlugin()],
})
