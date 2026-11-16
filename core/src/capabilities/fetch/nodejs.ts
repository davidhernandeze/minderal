import { NetworkError } from '../../errors.js'
import type { FetchOptions } from './contract.js'

export async function fetchFromNodejs(url: string, options: FetchOptions): Promise<Response> {
  try {
    return await fetch(url, toRequestInit(options))
  } catch (cause) {
    throw new NetworkError(url, cause)
  }
}

function toRequestInit(options: FetchOptions): RequestInit {
  const init: RequestInit = {}
  if (options.method !== undefined) init.method = options.method
  if (options.headers !== undefined) init.headers = { ...options.headers }
  if (options.body !== undefined) init.body = options.body
  return init
}
