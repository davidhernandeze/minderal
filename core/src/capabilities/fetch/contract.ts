import { defineCapability, type Implementation } from '../Capability.js'

export interface FetchOptions {
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string | Uint8Array<ArrayBuffer>
}

export type FetchArgs = readonly [url: string, options: FetchOptions]

export type FetchImplementation = Implementation<FetchArgs, Response>

export const fetchCapability = defineCapability<FetchArgs, Response>('fetch')

export function parseHttpUrl(url: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`fetch supports http and https URLs only, got ${parsed.protocol}`)
  }
  return parsed
}
