import { joinDataset, openDataset, type ClusterNode, type Core, type LinkQuality } from '@minderal/core'
import { computed, onScopeDispose, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'

const REMEMBERED = 'minderal-app:dataset'

export type Phase = 'starting' | 'disconnected' | 'joining' | 'ready'

export interface DevCluster {
  readonly datasetId: string
  readonly endpoint: string
}

export interface CoreState {
  readonly core: ShallowRef<Core | undefined>
  readonly phase: Ref<Phase>
  readonly error: Ref<string | undefined>
  readonly devCluster: Ref<DevCluster | undefined>
  readonly nodes: ComputedRef<readonly ClusterNode[]>
  readonly quality: (nodeId: string) => LinkQuality | undefined
  join(endpoint: string, name: string): Promise<void>
  leave(): Promise<void>
}

/** One browser core for the app: reopened from IndexedDB on reload, joined on request. */
export function useCore(): CoreState {
  const core = shallowRef<Core>()
  const phase = ref<Phase>('starting')
  const error = ref<string>()
  const devCluster = ref<DevCluster>()
  const revision = ref(0)
  let unsubscribe: (() => void) | undefined

  function adopt(next: Core): void {
    unsubscribe?.()
    core.value = next
    unsubscribe = next.cluster.subscribe(() => (revision.value += 1))
    revision.value += 1
    phase.value = 'ready'
    remember(next.datasetId)
  }

  const nodes = computed(() => {
    void revision.value
    return core.value?.cluster.nodes ?? []
  })

  function quality(nodeId: string): LinkQuality | undefined {
    void revision.value
    return core.value?.cluster.qualityOf(nodeId)
  }

  async function join(endpoint: string, name: string): Promise<void> {
    phase.value = 'joining'
    error.value = undefined
    try {
      adopt(await joinDataset(endpoint, name.trim() === '' ? {} : { name }))
    } catch (failure) {
      error.value = describe(failure)
      phase.value = 'disconnected'
    }
  }

  async function leave(): Promise<void> {
    unsubscribe?.()
    await core.value?.close()
    core.value = undefined
    forget()
    phase.value = 'disconnected'
  }

  async function start(): Promise<void> {
    devCluster.value = await loadDevCluster()
    const remembered = recall()
    if (remembered === undefined) {
      phase.value = 'disconnected'
      return
    }
    try {
      adopt(await openDataset(remembered))
    } catch (failure) {
      error.value = `Could not reopen dataset ${remembered}: ${describe(failure)}`
      forget()
      phase.value = 'disconnected'
    }
  }

  void start()
  onScopeDispose(() => {
    unsubscribe?.()
    void core.value?.close()
  })

  return { core, phase, error, devCluster, nodes, quality, join, leave }
}

async function loadDevCluster(): Promise<DevCluster | undefined> {
  try {
    const response = await fetch('/__dev-cluster')
    if (!response.ok) return undefined
    const value = (await response.json()) as Partial<DevCluster>
    return typeof value.endpoint === 'string' && typeof value.datasetId === 'string'
      ? { endpoint: value.endpoint, datasetId: value.datasetId }
      : undefined
  } catch {
    return undefined
  }
}

export function describe(failure: unknown): string {
  return failure instanceof Error ? `${failure.name}: ${failure.message}` : String(failure)
}

function remember(datasetId: string): void {
  try {
    localStorage.setItem(REMEMBERED, datasetId)
  } catch {
    // storage unavailable: the app joins again next time
  }
}

function recall(): string | undefined {
  try {
    return localStorage.getItem(REMEMBERED) ?? undefined
  } catch {
    return undefined
  }
}

function forget(): void {
  try {
    localStorage.removeItem(REMEMBERED)
  } catch {
    // nothing to forget
  }
}
