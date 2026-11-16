import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const againstDist = process.env.MINDERAL_TARGET === 'dist'
const entry = fileURLToPath(new URL(againstDist ? 'dist/index.js' : 'src/index.ts', import.meta.url))
const include = againstDist ? ['tests/e2e/**/*.test.ts'] : ['tests/**/*.test.ts']
const exclude = process.env.MINDERAL_TEST_COUCHDB_URL === undefined ? ['tests/**/*.couchdb.test.ts'] : []

export default defineConfig({
  resolve: {
    alias: { '@minderal/core': entry },
  },
  test: {
    globalSetup: ['tests/setup/httpServer.ts', 'tests/setup/couchdb.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'nodejs',
          environment: 'node',
          include,
          exclude,
          provide: { runtime: 'nodejs' },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include,
          exclude,
          provide: { runtime: 'browser' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
