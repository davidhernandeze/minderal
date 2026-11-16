import { createDataset, type Core, type CreateDatasetOptions } from '@minderal/core'
import { afterEach, inject } from 'vitest'

const opened: Core[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(async (core) => core.close()))
})

export function freshHome(): string {
  const id = crypto.randomUUID()
  return inject('runtime') === 'nodejs' ? `${inject('homeRoot')}/${id}` : `minderal-test-${id}`
}

export function track(core: Core): Core {
  opened.push(core)
  return core
}

export async function createTracked(options: CreateDatasetOptions = {}): Promise<Core> {
  return track(await createDataset({ home: freshHome(), ...options }))
}
