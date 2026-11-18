import { defineConfig } from '@playwright/test'

/** Regenerates the README screenshots: npm run screenshots */
export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  workers: 1,
  reporter: 'list'
})
