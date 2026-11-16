import { readStream } from '../util/bytes.js'
import { DEFAULT_PRESENCE, parseChannelMessage, type ChannelMessage, type ReplyBody } from './channel.js'
import type { Frame } from './frames.js'

const MIN_RETRY_MS = 500
const MAX_RETRY_MS = 30_000

export interface ChannelClientOptions {
  readonly nodeId: string
  /** The orchestrator endpoint to connect to now; undefined while there is none. */
  readonly endpoint: () => string | undefined
  readonly onMessage: (message: ChannelMessage) => void
  readonly onConnection: (connected: boolean) => void
}

/**
 * A member's channel to its orchestrator, kept open for as long as the core is: it reconnects with
 * backoff, renews its lease with heartbeats, and gives up on a connection that has gone quiet.
 */
export class ChannelClient {
  private readonly options: ChannelClientOptions
  private readonly lifetime: AbortController
  private current: AbortController | undefined
  private running: Promise<void> | undefined

  constructor(options: ChannelClientOptions) {
    this.options = options
    this.lifetime = new AbortController()
  }

  start(): void {
    this.running ??= this.loop()
  }

  async stop(): Promise<void> {
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
      if (welcomed) this.options.onConnection(false)
    }
    return welcomed
  }

  private async renew(endpoint: string, connection: AbortController): Promise<void> {
    try {
      const response = await fetch(`${base(endpoint)}/_minderal/channel/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ node: this.options.nodeId }),
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
