import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const browserLibraries = fileURLToPath(
  new URL('./node_modules/.cache/playwright-deps/lib/', import.meta.url),
)

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Support locally extracted Chromium libraries on Linux hosts without root access.
    env: process.platform === 'linux' && existsSync(browserLibraries)
      ? { LD_LIBRARY_PATH: [browserLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
      : {},
    // Hub/page-boot tests can exceed 5s under load; do not weaken assertions.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
