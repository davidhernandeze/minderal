import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const againstDist = process.env.MINDERAL_TARGET === 'dist'
const entry = fileURLToPath(new URL(againstDist ? 'dist/index.js' : 'src/index.ts', import.meta.url))
const include = againstDist ? ['tests/e2e/**/*.test.ts'] : ['tests/**/*.test.ts']

export default defineConfig({
  resolve: {
    alias: { '@minderal/core': entry },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include,
          provide: { runtime: 'node' },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include,
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
