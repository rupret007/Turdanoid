import { defineConfig } from 'vitest/config'
import { prepareBrowserLibraries } from './scripts/browser-libraries.mjs'

prepareBrowserLibraries()

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Hub/page-boot tests can exceed 5s under load; do not weaken assertions.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
