import PouchDB from 'pouchdb'
import { ConnectionError } from './ConnectionError.js'
import type { Neuron } from './Neuron.js'

export class Database {
  private readonly location: string
  private readonly username: string
  private readonly pouchOptions: PouchDB.Configuration.DatabaseConfiguration

  private constructor(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  ) {
    this.location = location
    this.username = username
    this.pouchOptions = pouchOptions
  }

  static create(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration = {}
  ): Database {
    return new Database(location, username, pouchOptions)
  }

  async createNeuron<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    const timestamp = new Date().toISOString()
    neuron.createdAt = timestamp
    neuron.updatedAt = timestamp
    neuron.createdBy = this.username

    const client = new PouchDB(this.location, this.pouchOptions)
    try {
      const response = await client.put(neuron.toDocument())
      neuron.revision = response.rev
      return neuron
    } catch (cause) {
      throw new ConnectionError(
        `Creating neuron ${neuron.id} in ${this.location} failed: ${describeCause(cause)}`
      )
    } finally {
      await client.close()
    }
  }
}

function describeCause(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null) return String(cause)
  const message = 'message' in cause ? String(cause.message) : String(cause)
  return 'status' in cause ? `${message} (${String(cause.status)})` : message
}
