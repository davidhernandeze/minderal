import PouchDB from 'pouchdb'
import findPlugin from 'pouchdb-find'
import { ConnectionError } from './ConnectionError.js'
import { NeuronError } from './NeuronError.js'
import { NeuronFactory } from './NeuronFactory.js'
import type { Neuron, NeuronDocument } from './Neuron.js'

PouchDB.plugin(findPlugin)

// Both PouchDB and CouchDB cap find() at 25 documents when no limit is given,
// so every query pages explicitly.
const FIND_PAGE_SIZE = 200

type NeuronClient = PouchDB.Database<NeuronDocument>

export interface NeuronQueryOptions {
  includeDeleted?: boolean
}

export class Database {
  private readonly location: string
  private readonly username: string
  private readonly pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  private client: NeuronClient | null
  private initialization: Promise<void> | null

  private constructor(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  ) {
    this.location = location
    this.username = username
    this.pouchOptions = pouchOptions
    this.client = null
    this.initialization = null
  }

  static open(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration = {}
  ): Database {
    return new Database(location, username, pouchOptions)
  }

  async initialize(): Promise<void> {
    this.initialization ??= this.setUp()
    try {
      await this.initialization
    } catch (cause) {
      this.initialization = null
      throw cause
    }
  }

  async create<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    await this.initialize()
    const timestamp = new Date().toISOString()
    neuron.createdAt = timestamp
    neuron.updatedAt = timestamp
    neuron.createdBy = this.username

    try {
      const response = await this.openClient().put(neuron.toDocument())
      neuron.revision = response.rev
      return neuron
    } catch (cause) {
      throw this.failure(`Creating neuron ${neuron.id}`, cause)
    }
  }

  async delete<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    await this.initialize()
    const timestamp = new Date().toISOString()

    try {
      const client = this.openClient()
      const descendants = await collectDescendants(client, neuron.id)
      const documents = [neuron, ...descendants].map((target) => {
        target.deletedAt = timestamp
        target.updatedAt = timestamp
        return target.toDocument()
      })

      const results = await client.bulkDocs(documents)
      const failure = results.find((result) => !isWriteSuccess(result))
      if (failure !== undefined) throw failure

      for (const result of results) {
        if (isWriteSuccess(result) && result.id === neuron.id) neuron.revision = result.rev
      }
      return neuron
    } catch (cause) {
      throw this.failure(`Deleting neuron ${neuron.id}`, cause)
    }
  }

  async get(id: string, options: NeuronQueryOptions = {}): Promise<Neuron | null> {
    await this.initialize()
    try {
      const document = await this.openClient().get(id)
      if (isDeleted(document) && options.includeDeleted !== true) return null
      return NeuronFactory.fromDocument(document)
    } catch (cause) {
      if (isNotFound(cause)) return null
      throw this.failure(`Reading neuron ${id}`, cause)
    }
  }

  async list(options: NeuronQueryOptions = {}): Promise<Neuron[]> {
    await this.initialize()
    try {
      const response = await this.openClient().allDocs({ include_docs: true })
      return toNeurons(
        response.rows.map((row) => row.doc),
        options
      )
    } catch (cause) {
      throw this.failure('Listing neurons', cause)
    }
  }

  async listByParentId(
    parentId: string | null,
    options: NeuronQueryOptions = {}
  ): Promise<Neuron[]> {
    await this.initialize()
    try {
      const selector =
        options.includeDeleted === true
          ? { parent_id: parentId }
          : { parent_id: parentId, deleted_at: null }
      return toNeurons(await findAll(this.openClient(), selector), options)
    } catch (cause) {
      throw this.failure(`Listing neurons under parent ${String(parentId)}`, cause)
    }
  }

  async close(): Promise<void> {
    const client = this.client
    if (client === null) return
    this.client = null
    this.initialization = null
    await client.close()
  }

  private async setUp(): Promise<void> {
    const client = this.openClient()
    try {
      await client.createIndex({ index: { fields: ['parent_id', 'deleted_at'] } })
      await client.createIndex({ index: { fields: ['deleted_at'] } })
    } catch (cause) {
      throw this.failure('Initializing', cause)
    }
  }

  private openClient(): NeuronClient {
    if (this.client === null) {
      this.client = new PouchDB<NeuronDocument>(this.location, this.pouchOptions)
    }
    return this.client
  }

  private failure(action: string, cause: unknown): Error {
    if (cause instanceof NeuronError) return cause
    return new ConnectionError(`${action} in ${this.location} failed: ${describeCause(cause)}`)
  }
}

async function findAll(
  client: NeuronClient,
  selector: PouchDB.Find.Selector
): Promise<NeuronDocument[]> {
  const documents: NeuronDocument[] = []
  for (;;) {
    const response = await client.find({
      selector,
      limit: FIND_PAGE_SIZE,
      skip: documents.length
    })
    documents.push(...response.docs)
    if (response.docs.length < FIND_PAGE_SIZE) return documents
  }
}

// Breadth-first down the parent_id chain, one query per level. The seen set
// guards against a parent_id cycle, which would otherwise never terminate.
async function collectDescendants(client: NeuronClient, rootId: string): Promise<Neuron[]> {
  const descendants: Neuron[] = []
  const seen = new Set<string>([rootId])
  let frontier = [rootId]

  while (frontier.length > 0) {
    const documents = await findAll(client, { parent_id: { $in: frontier }, deleted_at: null })
    const nextFrontier: string[] = []
    for (const document of documents) {
      if (seen.has(document._id)) continue
      seen.add(document._id)
      descendants.push(NeuronFactory.fromDocument(document))
      nextFrontier.push(document._id)
    }
    frontier = nextFrontier
  }
  return descendants
}

function isWriteSuccess(
  result: PouchDB.Core.Response | PouchDB.Core.Error
): result is PouchDB.Core.Response {
  return 'ok' in result && result.ok === true
}

function toNeurons(
  documents: Array<NeuronDocument | undefined>,
  options: NeuronQueryOptions
): Neuron[] {
  return documents
    .filter((document): document is NeuronDocument => document !== undefined)
    .filter((document) => !document._id.startsWith('_'))
    .filter((document) => options.includeDeleted === true || !isDeleted(document))
    .sort((left, right) => left._id.localeCompare(right._id))
    .map((document) => NeuronFactory.fromDocument(document))
}

function isDeleted(document: NeuronDocument): boolean {
  return (document.deleted_at ?? null) !== null
}

function isNotFound(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 404
}

function describeCause(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null) return String(cause)
  const message = 'message' in cause ? String(cause.message) : String(cause)
  return 'status' in cause ? `${message} (${String(cause.status)})` : message
}
