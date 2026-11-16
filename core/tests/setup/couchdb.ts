import type { TestProject } from 'vitest/node'

export default async function setup(project: TestProject): Promise<void> {
  const url = process.env.MINDERAL_TEST_COUCHDB_URL
  if (url === undefined) return
  const username = process.env.MINDERAL_TEST_COUCHDB_USERNAME ?? 'admin'
  const password = process.env.MINDERAL_TEST_COUCHDB_PASSWORD ?? 'password'
  const response = await fetch(new URL('/_up', url))
  if (!response.ok) throw new Error(`CouchDB at ${url} is not up: ${response.status}`)
  project.provide('couchdb', { url, credentials: { username, password } })
}
