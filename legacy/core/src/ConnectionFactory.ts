import { LocalConnection, type LocalConnectionOptions } from './LocalConnection.js'
import { RemoteConnection, type RemoteConnectionOptions } from './RemoteConnection.js'

export class ConnectionFactory {
  private constructor() {}

  static createLocalConnection(options: LocalConnectionOptions = {}): LocalConnection {
    return LocalConnection.create(options)
  }

  static createRemoteConnection(options: RemoteConnectionOptions): Promise<RemoteConnection> {
    return RemoteConnection.create(options)
  }
}
