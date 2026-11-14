#!/usr/bin/env node
// Lists the DigitalOcean domains on an account and files each one as a neuron
// under a single "domains" neuron, using @minderal/core the way any other
// program would: connect, create, set attributes, close.
//
//   DIGITALOCEAN_ACCESS_TOKEN=... node scripts/import-digitalocean-domains.mjs
//
// Running it again adds what is new and leaves what is already there alone.
import {
  ConnectionFactory,
  ObjectNeuron,
  StringNeuron
} from '../core/dist/index.js'

const token = process.env.DIGITALOCEAN_ACCESS_TOKEN
const apiUrl = process.env.DIGITALOCEAN_API_URL ?? 'https://api.digitalocean.com'
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const couchUser = process.env.COUCHDB_USER ?? 'admin'
const couchPassword = process.env.COUCHDB_PASSWORD ?? 'password'
const databaseName = process.env.MINDERAL_DATABASE ?? 'neurons'
const rootName = process.env.MINDERAL_ROOT ?? 'domains'

if (token === undefined || token.length === 0) {
  console.error('Set DIGITALOCEAN_ACCESS_TOKEN to a token with read access to domains.')
  process.exit(1)
}

// The listing is paged, and an account with more domains than one page would
// silently come back short otherwise.
async function fetchDomains() {
  const domains = []
  let next = `${apiUrl}/v2/domains?per_page=200`

  while (next !== null) {
    const response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      throw new Error(`DigitalOcean answered ${response.status} ${response.statusText}`)
    }
    const body = await response.json()
    domains.push(...(body.domains ?? []))
    next = body.links?.pages?.next ?? null
  }

  return domains
}

// One neuron to hold them all, reused on a second run rather than duplicated.
async function openRoot(database) {
  const existing = await database.listByParentId(null)
  const found = existing.find((neuron) => neuron.name === rootName)
  if (found !== undefined) return found
  return database.create(ObjectNeuron.create({ name: rootName }))
}

async function main() {
  const domains = await fetchDomains()
  console.log(`DigitalOcean returned ${domains.length} domain(s).`)

  const connection = await ConnectionFactory.createRemoteConnection({
    url: couchUrl,
    username: couchUser,
    password: couchPassword
  })

  try {
    const database = connection.getDatabase(databaseName)
    const root = await openRoot(database)
    const already = new Set((await database.listByParentId(root.id)).map((n) => n.name))

    let added = 0
    for (const domain of domains) {
      if (already.has(domain.name)) {
        console.log(`  = ${domain.name}`)
        continue
      }

      const neuron = await database.create(
        ObjectNeuron.create({ name: domain.name, parentId: root.id })
      )
      // ttl is a number on the wire; every neuron type here holds text, so it
      // is written as text rather than silently rounded into something else.
      if (domain.ttl !== undefined && domain.ttl !== null) {
        await database.setAttribute(neuron, 'ttl', StringNeuron.create({ value: String(domain.ttl) }))
      }
      console.log(`  + ${domain.name}`)
      added += 1
    }

    console.log(`Done: ${added} added, ${domains.length - added} already there, under "${rootName}".`)
  } finally {
    await connection.close()
  }
}

await main()
