import { createDataset, joinDataset, type Core, type CreateDatasetOptions, type JoinDatasetOptions } from '@minderal/core'
import { afterEach, inject } from 'vitest'

const opened: Core[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(async (core) => core.close()))
})

export function freshHome(): string {
  const id = crypto.randomUUID()
  return inject('runtime') === 'nodejs' ? `${inject('homeRoot')}/${id}` : `minderal-test-${id}`
}

export function track<Tracked extends Core>(core: Tracked): Tracked {
  opened.push(core)
  return core
}

export async function createTracked(options: CreateDatasetOptions = {}): Promise<Core> {
  return track(await createDataset({ home: freshHome(), ...options }))
}

export async function joinTracked(endpoint: string, options: JoinDatasetOptions = {}): Promise<Core> {
  return track(await joinDataset(endpoint, { home: freshHome(), ...options }))
}
