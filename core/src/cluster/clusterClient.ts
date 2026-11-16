import { ClusterError, NetworkError } from '../errors.js'

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Calls a cluster endpoint of another node (`<endpoint>/_minderal/<path>`). Unreachable endpoints raise
 * NetworkError; endpoints that answer with an error, or with something other than JSON, raise ClusterError.
 */
export async function callCluster(
  endpoint: string,
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ readonly value: unknown; readonly latencyMs: number }> {
  const url = `${endpoint.replace(/\/+$/, '')}/_minderal/${path}`
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    })
  } catch (cause) {
    throw new NetworkError(url, cause)
  }
  const latencyMs = Date.now() - startedAt
  let value: unknown
  try {
    value = await response.json()
  } catch (cause) {
    throw new ClusterError(endpoint, `answered ${path} with HTTP ${response.status} and no JSON`, cause)
  }
  if (!response.ok) {
    const reason = typeof value === 'object' && value !== null && 'reason' in value ? String(value.reason) : `HTTP ${response.status}`
    throw new ClusterError(endpoint, `refused ${path}: ${reason}`)
  }
  return { value, latencyMs }
}
