/**
 * A development cluster on this machine, for the app to join from Chrome.
 *
 *   orchestrator  "Dev orchestrator"   serves on :5985, holds the seeded documents
 *   member        "Media box"          Node.js member, serves on :5986 — a second node to delegate to
 *   member        "Desk"               Node.js member, not serving — a node that only syncs
 *
 * The first run creates the dataset and seeds it; later runs reopen the same dataset, so whatever you
 * do in the app survives restarts. `--reset` wipes it and starts over. `--activity` writes a note every
 * few seconds from the orchestrator, to watch live sync arrive in the browser.
 *
 * State lives in app/.dev-cluster/: one home per node, and state.json, which the Vite dev server reads to
 * tell the app where to join.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDataset, joinDataset, openDataset, type Core } from '../../core/src/index.ts'
import { seedDocuments } from './seed.ts'

const root = fileURLToPath(new URL('../.dev-cluster/', import.meta.url))
const statePath = join(root, 'state.json')
const host = process.env.DEV_CLUSTER_HOST ?? '127.0.0.1'
const port = Number(process.env.DEV_CLUSTER_PORT ?? '5985')
const origins = (process.env.DEV_CLUSTER_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')
const activityMs = Number(process.env.DEV_CLUSTER_ACTIVITY_MS ?? '5000')

interface MemberPlan {
  readonly name: string
  readonly port: number | undefined
}

interface State {
  readonly datasetId: string
  readonly endpoint: string
  readonly members: readonly { readonly name: string; readonly nodeId: string; readonly port: number | undefined }[]
}

const memberPlans: readonly MemberPlan[] = [
  { name: 'Media box', port: port + 1 },
  { name: 'Desk', port: undefined },
]

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    await rm(root, { recursive: true, force: true })
    console.log('dev cluster: reset')
  }
  await mkdir(root, { recursive: true })
  const cores = existsSync(statePath) ? await reopen(JSON.parse(await readFile(statePath, 'utf8')) as State) : await create()
  const [orchestrator] = cores
  const self = orchestrator?.cluster.self
  console.log(`dev cluster: ${orchestrator?.datasetId}`)
  for (const core of cores) {
    const node = core.cluster.self
    console.log(`  ${node?.role.padEnd(12)} ${node?.name.padEnd(18)} ${node?.endpoint ?? '(not serving)'}`)
  }
  console.log(`join from the app, or: ${self?.endpoint}`)

  if (process.argv.includes('--activity') && orchestrator !== undefined) {
    let tick = 0
    setInterval(() => {
      tick += 1
      void orchestrator.documents.put({
        _id: `note:activity-${Date.now()}`,
        type: 'note',
        title: `Activity #${tick}`,
        body: 'Written by the dev orchestrator to show live sync.',
        tags: ['activity'],
        createdAt: new Date().toISOString(),
      })
    }, activityMs)
    console.log(`writing a note every ${activityMs} ms`)
  }

  const shutdown = async (): Promise<void> => {
    await Promise.allSettled(cores.map(async (core) => core.close()))
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

async function create(): Promise<Core[]> {
  const orchestrator = await createDataset({ home: join(root, 'orchestrator'), name: 'Dev orchestrator' })
  const endpoint = await orchestrator.serve({ host, port, origins })
  for (const document of seedDocuments()) await orchestrator.documents.put(document)
  const members: Core[] = []
  for (const plan of memberPlans) {
    const member = await joinDataset(endpoint, { home: join(root, slug(plan.name)), name: plan.name })
    if (plan.port !== undefined) await member.serve({ host, port: plan.port, origins })
    members.push(member)
  }
  const state: State = {
    datasetId: orchestrator.datasetId,
    endpoint,
    members: memberPlans.map((plan, index) => ({ name: plan.name, nodeId: members[index]?.nodeId ?? '', port: plan.port })),
  }
  await writeFile(statePath, JSON.stringify(state, null, 2))
  console.log(`dev cluster: created and seeded`)
  return [orchestrator, ...members]
}

async function reopen(state: State): Promise<Core[]> {
  const orchestrator = await openDataset(state.datasetId, { home: join(root, 'orchestrator') })
  await orchestrator.serve({ host, port, origins })
  const members: Core[] = []
  for (const member of state.members) {
    const core = await openDataset(state.datasetId, { home: join(root, slug(member.name)) })
    if (member.port !== undefined) await core.serve({ host, port: member.port, origins })
    members.push(core)
  }
  return [orchestrator, ...members]
}

function slug(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
}

main().catch((error: unknown) => {
  console.error('dev cluster failed:', error)
  process.exit(1)
})
