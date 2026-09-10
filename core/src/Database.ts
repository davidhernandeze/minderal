import PouchDB from 'pouchdb'
import findPlugin from 'pouchdb-find'
import { ConnectionError } from './ConnectionError.js'
import { NeuronError } from './NeuronError.js'
import { NeuronFactory } from './NeuronFactory.js'
import type { Neuron, NeuronDocument } from './Neuron.js'

PouchDB.plugin(findPlugin)

type NeuronClient = PouchDB.Database<NeuronDocument>

export class Database {
  private readonly location: string
  private readonly username: string
  private readonly pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  private client: NeuronClient | null

  private constructor(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  ) {
    this.location = location
    this.username = username
    this.pouchOptions = pouchOptions
    this.client = null
  }

  static open(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration = {}
  ): Database {
    return new Database(location, username, pouchOptions)
  }

  async create<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
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

  async get(id: string): Promise<Neuron | null> {
    try {
      return NeuronFactory.fromDocument(await this.openClient().get(id))
    } catch (cause) {
      if (isNotFound(cause)) return null
      throw this.failure(`Reading neuron ${id}`, cause)
    }
  }

  async list(): Promise<Neuron[]> {
    try {
      const response = await this.openClient().allDocs({ include_docs: true })
      return toNeurons(response.rows.map((row) => row.doc))
    } catch (cause) {
      throw this.failure('Listing neurons', cause)
    }
  }

  async listByParentId(parentId: string | null): Promise<Neuron[]> {
    try {
      const client = this.openClient()
      await client.createIndex({ index: { fields: ['parent_id'] } })
      const response = await client.find({ selector: { parent_id: parentId } })
      return toNeurons(response.docs)
    } catch (cause) {
      throw this.failure(`Listing neurons under parent ${String(parentId)}`, cause)
    }
  }

  async close(): Promise<void> {
    const client = this.client
    if (client === null) return
    this.client = null
    await client.close()
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

function toNeurons(documents: Array<NeuronDocument | undefined>): Neuron[] {
  return documents
    .filter((document): document is NeuronDocument => document !== undefined)
    .filter((document) => !document._id.startsWith('_'))
    .sort((left, right) => left._id.localeCompare(right._id))
    .map((document) => NeuronFactory.fromDocument(document))
}

function isNotFound(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 404
}

function describeCause(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null) return String(cause)
  const message = 'message' in cause ? String(cause.message) : String(cause)
  return 'status' in cause ? `${message} (${String(cause.status)})` : message
}
