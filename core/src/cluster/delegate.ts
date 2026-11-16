import type { Capability } from '../capabilities/Capability.js'
import { CapabilityUnavailableError, DelegationError, PartialResultError, type DelegationAttempt } from '../errors.js'
import { readStream } from '../util/bytes.js'
import type { ClusterNode } from './ClusterDocument.js'
import { chunkBytes, decodeFrames, deserializeError, isUnavailable, type Frame } from './frames.js'
import type { QualityLedger } from './QualityLedger.js'

export const NODE_HEADER = 'x-minderal-node'

export function invokeUrl(endpoint: string, capabilityId: string): string {
  return `${endpoint.replace(/\/+$/, '')}/_minderal/invoke/${encodeURIComponent(capabilityId)}`
}

export function relayUrl(orchestratorEndpoint: string, nodeId: string, capabilityId: string): string {
  return `${orchestratorEndpoint.replace(/\/+$/, '')}/_minderal/relay/${encodeURIComponent(nodeId)}/invoke/${encodeURIComponent(capabilityId)}`
}

/** A way to reach a node with a request: its own endpoint, or a relay through the orchestrator. */
export interface Route {
  readonly node: ClusterNode
  /** Sends the encoded arguments; answers like an invoke endpoint: 200 and frames, or a refusal. */
  open(capabilityId: string, args: unknown, selfId: string): Promise<Response>
}

export function directRoute(node: ClusterNode, endpoint: string): Route {
  return { node, open: async (capabilityId, args, selfId) => post(invokeUrl(endpoint, capabilityId), args, selfId) }
}

export function relayedRoute(node: ClusterNode, orchestratorEndpoint: string): Route {
  return { node, open: async (capabilityId, args, selfId) => post(relayUrl(orchestratorEndpoint, node.id, capabilityId), args, selfId) }
}

async function post(url: string, args: unknown, selfId: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [NODE_HEADER]: selfId },
    body: JSON.stringify({ args }),
  })
}

/**
 * Performs a capability on another node. Candidates are tried in the ledger's order while they cannot take
 * the request — unreachable, refusing, or no longer able to perform it — since none of that ran anything.
 * Once a node accepts the request the outcome is final, whatever it is:
 *
 * - complete: the result, its body streaming as it arrives;
 * - error: the capability's own error (TypeError, NetworkError…) or DelegationError if the node failed;
 * - partial: the result, whose body throws PartialResultError where it was cut.
 *
 * Nothing is retried after acceptance: the capability may have run, and running it twice is not safe for
 * every capability. Every outcome is recorded in the ledger.
 */
export async function delegate<Args extends readonly unknown[], Result>(
  capability: Capability<Args, Result>,
  args: Args,
  routes: readonly Route[],
  context: {
    readonly selfId: string
    readonly ledger: QualityLedger
    readonly prefer?: string
    readonly onServed?: (nodeId: string) => void
  },
): Promise<Result> {
  const wire = capability.wire
  if (wire === undefined) throw new CapabilityUnavailableError(capability.id)
  const encoded = wire.encodeArgs(args)
  const attempts: DelegationAttempt[] = []
  const byNode = new Map(routes.map((route) => [route.node.id, route]))
  const ranked = context.ledger.rank(routes.map((route) => route.node))
  const preferred = ranked.findIndex((node) => node.id === context.prefer)
  if (preferred > 0) ranked.unshift(...ranked.splice(preferred, 1))

  for (const node of ranked) {
    const route = byNode.get(node.id)
    if (route === undefined) continue
    const startedAt = Date.now()
    const refuse = (reason: string): void => {
      attempts.push({ nodeId: node.id, reason })
      context.ledger.recordFailure(node.id, reason)
    }

    let response: Response
    try {
      response = await route.open(capability.id, encoded, context.selfId)
    } catch (error) {
      refuse(`is unreachable (${error instanceof Error ? error.message : String(error)})`)
      continue
    }
    if (!response.ok || response.body === null) {
      refuse(`refused with HTTP ${response.status}`)
      await response.body?.cancel().catch(() => undefined)
      continue
    }

    const frames = decodeFrames(readStream(response.body))
    let first: IteratorResult<Frame>
    try {
      first = await frames.next()
    } catch (cause) {
      context.ledger.recordFailure(node.id, 'went away before answering')
      throw new DelegationError(capability.id, node.id, 'it went away before answering', cause)
    }
    if (first.done === true || first.value.t === 'chunk' || first.value.t === 'end') {
      context.ledger.recordFailure(node.id, 'answered without a result')
      await frames.return(undefined)
      throw new DelegationError(capability.id, node.id, 'it answered without a result')
    }
    if (first.value.t === 'error') {
      const error = first.value.e
      await frames.return(undefined)
      if (isUnavailable(error)) {
        refuse('can no longer perform it')
        continue
      }
      context.ledger.recordSuccess(node.id, Date.now() - startedAt)
      throw deserializeError(error)
    }

    context.ledger.recordSuccess(node.id, Date.now() - startedAt)
    context.onServed?.(node.id)
    const body = resultBody(frames, capability.id, node.id, context.ledger)
    try {
      return await wire.decodeResult(first.value.v, body)
    } catch (cause) {
      await body.return(undefined)
      if (cause instanceof PartialResultError) throw cause
      throw new DelegationError(capability.id, node.id, 'its result could not be read', cause)
    }
  }

  throw new CapabilityUnavailableError(capability.id, attempts)
}

async function* resultBody(
  frames: AsyncGenerator<Frame>,
  capabilityId: string,
  nodeId: string,
  ledger: QualityLedger,
): AsyncGenerator<Uint8Array> {
  let received = 0
  const cut = (cause: unknown): PartialResultError => {
    ledger.recordFailure(nodeId, 'cut a result short')
    return new PartialResultError(capabilityId, nodeId, received, cause)
  }
  try {
    while (true) {
      let next: IteratorResult<Frame>
      try {
        next = await frames.next()
      } catch (cause) {
        throw cut(cause)
      }
      if (next.done === true) throw cut(new Error('the stream ended without completing'))
      const frame = next.value
      if (frame.t === 'end') return
      if (frame.t === 'error') throw cut(deserializeError(frame.e))
      if (frame.t === 'head') throw cut(new SyntaxError('a second head arrived'))
      const bytes = chunkBytes(frame)
      received += bytes.length
      yield bytes
    }
  } finally {
    await frames.return(undefined)
  }
}
