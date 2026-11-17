import { readStream } from '../util/bytes.js'
import { DEFAULT_PRESENCE, parseChannelMessage, type ChangeNotice, type ChannelMessage, type ReplyBody, type Seq } from './channel.js'
import type { Frame } from './frames.js'

const MIN_RETRY_MS = 500
const MAX_RETRY_MS = 30_000

export interface ChannelClientOptions {
  readonly nodeId: string
  /** The orchestrator endpoint to connect to now; undefined while there is none. */
  readonly endpoint: () => string | undefined
  readonly onMessage: (message: ChannelMessage) => void
  readonly onConnection: (connected: boolean) => void
  /** Where this node's changes feed is, reported with every heartbeat; undefined for a node holding no copy. */
  readonly seq?: () => Seq | undefined
}

/** A seq that moved is reported this soon, not at the next heartbeat. */
const REPORT_DELAY_MS = 250

/**
 * A member's channel to its orchestrator, kept open for as long as the core is: it reconnects with
 * backoff, renews its lease with heartbeats, and gives up on a connection that has gone quiet.
 */
export class ChannelClient {
  private readonly options: ChannelClientOptions
  private readonly lifetime: AbortController
  private current: AbortController | undefined
  private running: Promise<void> | undefined
  private connectedTo: { readonly endpoint: string; readonly connection: AbortController } | undefined
  private reportTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: ChannelClientOptions) {
    this.options = options
    this.lifetime = new AbortController()
  }

  start(): void {
    this.running ??= this.loop()
  }

  async stop(): Promise<void> {
    clearTimeout(this.reportTimer)
    this.lifetime.abort()
    this.current?.abort()
    await this.running
  }

  /** Sends frames answering a relayed request; false once the orchestrator no longer wants them. */
  async reply(requestId: string, frames: readonly Frame[]): Promise<boolean> {
    const endpoint = this.options.endpoint()
    if (endpoint === undefined) return false
    const body: ReplyBody = { node: this.options.nodeId, request: requestId, frames }
    try {
      const response = await fetch(`${base(endpoint)}/_minderal/channel/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.lifetime.signal,
      })
      await response.body?.cancel().catch(() => undefined)
      return response.ok
    } catch {
      return false
    }
  }

  /** Tells the orchestrator this node's copy changed; false when it could not be told — reconnecting catches up. */
  async notify(notice: ChangeNotice): Promise<boolean> {
    return this.post('channel/changed', notice)
  }

  /** Reports a moved seq shortly, folding a burst of changes into one heartbeat. */
  reportSoon(): void {
    if (this.connectedTo === undefined || this.reportTimer !== undefined) return
    this.reportTimer = setTimeout(() => {
      this.reportTimer = undefined
      const connected = this.connectedTo
      if (connected !== undefined) void this.renew(connected.endpoint, connected.connection)
    }, REPORT_DELAY_MS)
  }

  private async post(path: string, body: unknown): Promise<boolean> {
    const endpoint = this.options.endpoint()
    if (endpoint === undefined || this.connectedTo === undefined) return false
    try {
      const response = await fetch(`${base(endpoint)}/_minderal/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.lifetime.signal,
      })
      await response.body?.cancel().catch(() => undefined)
      return response.ok
    } catch {
      return false
    }
  }

  private async loop(): Promise<void> {
    let retry = MIN_RETRY_MS
    while (!this.lifetime.signal.aborted) {
      const endpoint = this.options.endpoint()
      if (endpoint !== undefined) {
        const welcomed = await this.connect(endpoint)
        if (welcomed) retry = MIN_RETRY_MS
      }
      if (this.lifetime.signal.aborted) return
      await sleep(retry, this.lifetime.signal)
      retry = Math.min(retry * 2, MAX_RETRY_MS)
    }
  }

  /** One connection, until it ends. Returns whether the orchestrator welcomed it. */
  private async connect(endpoint: string): Promise<boolean> {
    const connection = new AbortController()
    this.current = connection
    const signal = AbortSignal.any([this.lifetime.signal, connection.signal])
    let welcomed = false
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let quiet: ReturnType<typeof setTimeout> | undefined
    let leaseMs = DEFAULT_PRESENCE.leaseMs
    const stillAlive = (): void => {
      clearTimeout(quiet)
      quiet = setTimeout(() => connection.abort(), leaseMs)
    }
    try {
      const response = await fetch(`${base(endpoint)}/_minderal/channel?node=${encodeURIComponent(this.options.nodeId)}`, { signal })
      if (!response.ok || response.body === null) {
        await response.body?.cancel().catch(() => undefined)
        return false
      }
      const decoder = new TextDecoder()
      let buffered = ''
      for await (const bytes of readStream(response.body)) {
        buffered += decoder.decode(bytes, { stream: true })
        let newline = buffered.indexOf('\n')
        while (newline !== -1) {
          const line = buffered.slice(0, newline)
          buffered = buffered.slice(newline + 1)
          newline = buffered.indexOf('\n')
          if (line.trim() === '') continue
          const message = parseChannelMessage(line)
          if (message === undefined) continue
          stillAlive()
          if (message.t === 'welcome') {
            welcomed = true
            leaseMs = message.leaseMs
            stillAlive()
            clearInterval(heartbeat)
            heartbeat = setInterval(() => void this.renew(endpoint, connection), message.heartbeatMs)
            this.connectedTo = { endpoint, connection }
            void this.renew(endpoint, connection)
            this.options.onConnection(true)
          }
          this.options.onMessage(message)
        }
      }
    } catch {
      // aborted, refused or dropped: the loop reconnects
    } finally {
      clearInterval(heartbeat)
      clearTimeout(quiet)
      if (this.current === connection) this.current = undefined
      if (this.connectedTo?.connection === connection) this.connectedTo = undefined
      if (welcomed) this.options.onConnection(false)
    }
    return welcomed
  }

  private async renew(endpoint: string, connection: AbortController): Promise<void> {
    const seq = this.options.seq?.()
    try {
      const response = await fetch(`${base(endpoint)}/_minderal/channel/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ node: this.options.nodeId, ...(seq === undefined ? {} : { seq }) }),
        signal: this.lifetime.signal,
      })
      await response.body?.cancel().catch(() => undefined)
      // the orchestrator no longer knows this channel: drop it and connect again
      if (response.status === 404) connection.abort()
    } catch {
      // a missed heartbeat; the lease tolerates a few
    }
  }
}

function base(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done)
  })
}
