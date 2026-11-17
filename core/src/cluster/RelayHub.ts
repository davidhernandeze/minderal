import { encodeFrame, type Frame } from './frames.js'
import type { ChannelMessage, Presence, PresenceTiming, Seq } from './channel.js'

export interface ChannelSink {
  send(message: ChannelMessage): void
  close(): void
}

interface Channel {
  readonly nodeId: string
  readonly sink: ChannelSink
  readonly since: Date
  lastHeartbeat: number
  seq: Seq | undefined
  changedAt: Date | undefined
}

interface Pending {
  readonly id: string
  readonly nodeId: string
  readonly controller: ReadableStreamDefaultController<Uint8Array>
  started: boolean
  finished: boolean
  readonly firstFrame: (started: boolean) => void
}

/** Requests to a node wait this long for its first frame; long enough for a long-poll it answers, should anyone send one. */
const FIRST_FRAME_TIMEOUT_MS = 300_000

/**
 * The orchestrator's side of member channels: who is online (presence, with leases), and relaying
 * capability requests to nodes that cannot accept connections. Runtime-neutral.
 */
export class RelayHub {
  private readonly timing: PresenceTiming
  private readonly channels: Map<string, Channel>
  private readonly pending: Map<string, Pending>
  private readonly onPresence: () => void
  private readonly sweeper: ReturnType<typeof setInterval>
  private closed: boolean

  constructor(timing: PresenceTiming, onPresence: () => void) {
    this.timing = timing
    this.channels = new Map()
    this.pending = new Map()
    this.onPresence = onPresence
    this.closed = false
    this.sweeper = setInterval(() => this.sweep(), timing.heartbeatMs)
    ;(this.sweeper as { unref?: () => void }).unref?.()
  }

  get presenceTiming(): PresenceTiming {
    return this.timing
  }

  presence(): Presence[] {
    return [...this.channels.values()].map((channel) => ({
      id: channel.nodeId,
      since: channel.since.toISOString(),
      ...(channel.seq === undefined ? {} : { seq: channel.seq }),
      ...(channel.changedAt === undefined ? {} : { changedAt: channel.changedAt.toISOString() }),
    }))
  }

  isOnline(nodeId: string): boolean {
    return this.channels.has(nodeId)
  }

  /** Opens a member's channel, replacing one it had. Returns the function to call when it closes. */
  connect(nodeId: string, sink: ChannelSink): () => void {
    if (this.closed) {
      sink.close()
      return () => undefined
    }
    const previous = this.channels.get(nodeId)
    const channel: Channel = {
      nodeId,
      sink,
      since: previous?.since ?? new Date(),
      lastHeartbeat: Date.now(),
      seq: previous?.seq,
      changedAt: previous?.changedAt,
    }
    this.channels.set(nodeId, channel)
    if (previous !== undefined) this.drop(previous, false)
    sink.send({ t: 'welcome', heartbeatMs: this.timing.heartbeatMs, leaseMs: this.timing.leaseMs })
    if (previous === undefined) this.onPresence()
    return () => {
      if (this.channels.get(nodeId) === channel) this.disconnect(channel)
    }
  }

  heartbeat(nodeId: string): boolean {
    const channel = this.channels.get(nodeId)
    if (channel === undefined) return false
    channel.lastHeartbeat = Date.now()
    return true
  }

  /** Records where a member's changes feed is. Returns whether it moved, which presence then shows. */
  progress(nodeId: string, seq: Seq): boolean {
    const channel = this.channels.get(nodeId)
    if (channel === undefined || channel.seq === seq) return false
    channel.seq = seq
    channel.changedAt = new Date()
    return true
  }

  broadcast(message: ChannelMessage, except?: string): void {
    for (const channel of this.channels.values()) if (channel.nodeId !== except) channel.sink.send(message)
  }

  /**
   * Relays a capability request to a member over its channel. Resolves with an HTTP-like response, as
   * an endpoint would answer: 503 when the node is not connected or leaves before answering, otherwise
   * 200 and a stream of delegation frames that stops short if the node leaves mid-answer.
   */
  async open(nodeId: string, capabilityId: string, args: unknown, signal?: AbortSignal): Promise<Response> {
    const channel = this.channels.get(nodeId)
    if (channel === undefined || this.closed) return unavailable(`Node ${nodeId} is not connected`)
    const id = crypto.randomUUID()
    let resolveFirst: (started: boolean) => void = () => undefined
    const first = new Promise<boolean>((resolve) => (resolveFirst = resolve))
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const stream = new ReadableStream<Uint8Array>({
      start: (start) => {
        controller = start
      },
      cancel: () => this.cancel(id),
    })
    const entry: Pending = { id, nodeId, controller: controller!, started: false, finished: false, firstFrame: resolveFirst }
    this.pending.set(id, entry)
    const timer = setTimeout(() => this.fail(entry), FIRST_FRAME_TIMEOUT_MS)
    ;(timer as { unref?: () => void }).unref?.()
    const onAbort = (): void => this.cancel(id)
    signal?.addEventListener('abort', onAbort)
    channel.sink.send({ t: 'request', id, capability: capabilityId, args })
    const started = await first
    clearTimeout(timer)
    if (!started) {
      signal?.removeEventListener('abort', onAbort)
      return unavailable(`Node ${nodeId} left before answering`)
    }
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
  }

  /** Frames a member sends back for a request. False when the request is unknown, finished or cancelled. */
  reply(nodeId: string, requestId: string, frames: readonly Frame[]): boolean {
    const entry = this.pending.get(requestId)
    if (entry === undefined || entry.nodeId !== nodeId) return false
    for (const frame of frames) {
      if (entry.finished) break
      entry.controller.enqueue(new TextEncoder().encode(encodeFrame(frame)))
      if (!entry.started) {
        entry.started = true
        entry.firstFrame(true)
      }
      if (frame.t === 'end' || frame.t === 'error') this.finish(entry)
    }
    return true
  }

  close(): void {
    this.closed = true
    clearInterval(this.sweeper)
    for (const channel of [...this.channels.values()]) this.disconnect(channel)
  }

  private cancel(requestId: string): void {
    const entry = this.pending.get(requestId)
    if (entry === undefined) return
    this.pending.delete(requestId)
    entry.finished = true
    if (!entry.started) entry.firstFrame(false)
    this.channels.get(entry.nodeId)?.sink.send({ t: 'cancel', id: requestId })
  }

  /**
   * Ends a relayed answer. One that never started becomes a 503; one closed without its end frame — the
   * node left mid-answer — reads as cut short on the requester's side.
   */
  private finish(entry: Pending): void {
    if (entry.finished) return
    entry.finished = true
    this.pending.delete(entry.id)
    if (!entry.started) entry.firstFrame(false)
    else entry.controller.close()
  }

  private fail(entry: Pending): void {
    this.finish(entry)
  }

  private disconnect(channel: Channel): void {
    this.drop(channel, true)
  }

  private drop(channel: Channel, removePresence: boolean): void {
    if (removePresence) this.channels.delete(channel.nodeId)
    for (const entry of [...this.pending.values()]) {
      if (entry.nodeId === channel.nodeId && (removePresence || this.channels.get(channel.nodeId) !== channel)) this.fail(entry)
    }
    try {
      channel.sink.close()
    } catch {
      // already closed
    }
    if (removePresence) this.onPresence()
  }

  private sweep(): void {
    const now = Date.now()
    for (const channel of [...this.channels.values()]) {
      if (now - channel.lastHeartbeat > this.timing.leaseMs) this.disconnect(channel)
      else channel.sink.send({ t: 'ping' })
    }
  }
}

function unavailable(reason: string): Response {
  return new Response(JSON.stringify({ error: 'unavailable', reason }), { status: 503, headers: { 'content-type': 'application/json' } })
}
