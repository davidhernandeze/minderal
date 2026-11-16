import { afterEach, describe, expect, it } from 'vitest'
import { fetchCapability } from '../../src/capabilities/fetch/contract.js'
import type { ChannelMessage } from '../../src/cluster/channel.js'
import { newNode } from '../../src/cluster/ClusterDocument.js'
import { delegate } from '../../src/cluster/delegate.js'
import { QualityLedger } from '../../src/cluster/QualityLedger.js'
import { RelayHub } from '../../src/cluster/RelayHub.js'
import { PartialResultError } from '../../src/errors.js'

const hubs: RelayHub[] = []
afterEach(() => hubs.splice(0).forEach((hub) => hub.close()))

function hub(timing = { heartbeatMs: 1000, leaseMs: 5000 }): { hub: RelayHub; changes: () => number } {
  let changes = 0
  const created = new RelayHub(timing, () => (changes += 1))
  hubs.push(created)
  return { hub: created, changes: () => changes }
}

function channel(): { messages: ChannelMessage[]; closed: () => boolean; sink: { send(m: ChannelMessage): void; close(): void } } {
  const messages: ChannelMessage[] = []
  let closed = false
  return { messages, closed: () => closed, sink: { send: (message) => messages.push(message), close: () => (closed = true) } }
}

async function nextRequest(messages: ChannelMessage[]): Promise<Extract<ChannelMessage, { t: 'request' }>> {
  await expect.poll(() => messages.some((message) => message.t === 'request')).toBe(true)
  return messages.find((message) => message.t === 'request') as Extract<ChannelMessage, { t: 'request' }>
}

const member = newNode('member', 'member', { name: 'm', runtime: 'browser', coreVersion: '0.0.0', capabilities: ['fetch@1'] }, new Date())

describe('RelayHub', () => {
  it('welcomes a channel and tracks presence', () => {
    const { hub: relay, changes } = hub()
    const { messages, sink, closed } = channel()
    const disconnect = relay.connect('a', sink)
    expect(messages[0]).toEqual({ t: 'welcome', heartbeatMs: 1000, leaseMs: 5000 })
    expect(relay.isOnline('a')).toBe(true)
    expect(relay.presence()).toEqual([{ id: 'a', since: expect.any(String) }])
    disconnect()
    expect(relay.isOnline('a')).toBe(false)
    expect(closed()).toBe(true)
    expect(changes()).toBe(2)
  })

  it('expires a channel whose lease is not renewed', async () => {
    const { hub: relay } = hub({ heartbeatMs: 20, leaseMs: 60 })
    relay.connect('a', channel().sink)
    await expect.poll(() => relay.isOnline('a')).toBe(false)
  })

  it('answers 503 for a node that is not connected', async () => {
    const { hub: relay } = hub()
    expect((await relay.open('nobody', 'fetch@1', {})).status).toBe(503)
  })

  it('relays a request down the channel and streams the frames replied', async () => {
    const { hub: relay } = hub()
    const { messages, sink } = channel()
    relay.connect('member', sink)
    const result = delegate(fetchCapability, ['http://x/', {}], [{ node: member, open: async (id, args) => relay.open('member', id, args) }], {
      selfId: 'me',
      ledger: new QualityLedger(),
    })
    const request = await nextRequest(messages)
    expect(request).toMatchObject({ capability: 'fetch@1', args: { url: 'http://x/' } })
    relay.reply('member', request.id, [{ t: 'head', v: { status: 200, statusText: 'OK', headers: [] } }])
    relay.reply('member', request.id, [{ t: 'chunk', b: btoa('hi') }, { t: 'end' }])
    expect(await (await result).text()).toBe('hi')
  })

  it('answers 503 when the node leaves before answering', async () => {
    const { hub: relay } = hub()
    const { messages, sink } = channel()
    const disconnect = relay.connect('member', sink)
    const response = relay.open('member', 'fetch@1', {})
    await nextRequest(messages)
    disconnect()
    expect((await response).status).toBe(503)
  })

  it('cuts the answer short when the node leaves mid-answer, which reads as PartialResultError', async () => {
    const { hub: relay } = hub()
    const { messages, sink } = channel()
    const disconnect = relay.connect('member', sink)
    const result = delegate(fetchCapability, ['http://x/', {}], [{ node: member, open: async (id, args) => relay.open('member', id, args) }], {
      selfId: 'me',
      ledger: new QualityLedger(),
    })
    const request = await nextRequest(messages)
    relay.reply('member', request.id, [{ t: 'head', v: { status: 200, statusText: 'OK', headers: [] } }, { t: 'chunk', b: btoa('par') }])
    const response = await result
    disconnect()
    await expect(response.text()).rejects.toThrow(PartialResultError)
  })

  it('tells the node to stop when the requester goes away', async () => {
    const { hub: relay } = hub()
    const { messages, sink } = channel()
    relay.connect('member', sink)
    const abort = new AbortController()
    const response = relay.open('member', 'fetch@1', {}, abort.signal)
    const request = await nextRequest(messages)
    abort.abort()
    expect((await response).status).toBe(503)
    expect(messages).toContainEqual({ t: 'cancel', id: request.id })
    expect(relay.reply('member', request.id, [{ t: 'end' }])).toBe(false)
  })

  it('refuses replies from another node than the one asked', async () => {
    const { hub: relay } = hub()
    const { messages, sink } = channel()
    relay.connect('member', sink)
    void relay.open('member', 'fetch@1', {})
    const request = await nextRequest(messages)
    expect(relay.reply('intruder', request.id, [{ t: 'end' }])).toBe(false)
  })
})
