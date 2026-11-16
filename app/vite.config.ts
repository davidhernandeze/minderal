import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const coreSource = fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
const statePath = fileURLToPath(
  new URL(process.env.DEV_CLUSTER_MODE === 'relay' ? '.dev-cluster-relay/state.json' : '.dev-cluster/state.json', import.meta.url),
)

/**
 * Runs the dev cluster (scripts/devCluster.ts) next to the dev server and tells the app where to join
 * at /__dev-cluster. Set MINDERAL_DEV_CLUSTER=off to run `npm run cluster` yourself instead.
 */
function devCluster(): Plugin {
  let child: ChildProcess | undefined
  return {
    name: 'minderal-dev-cluster',
    apply: 'serve',
    configureServer(server) {
      if (process.env.MINDERAL_DEV_CLUSTER !== 'off') {
        const args = ['scripts/devCluster.ts', ...(process.env.MINDERAL_DEV_ACTIVITY === 'on' ? ['--activity'] : [])]
        // tsx itself, not through npx: a signal sent to a wrapper does not always reach the cluster
        const tsx = fileURLToPath(new URL('node_modules/.bin/tsx', import.meta.url))
        child = spawn(tsx, args, { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit' })
        server.httpServer?.on('close', () => child?.kill('SIGTERM'))
        process.on('exit', () => child?.kill('SIGTERM'))
      }
      server.middlewares.use('/__dev-cluster', (_request, response) => {
        response.setHeader('content-type', 'application/json')
        if (!existsSync(statePath)) {
          response.statusCode = 404
          response.end(JSON.stringify({ error: 'The dev cluster has not started yet' }))
          return
        }
        response.end(readFileSync(statePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), devCluster()],
  resolve: {
    alias: { '@minderal/core': coreSource },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
  },
})
