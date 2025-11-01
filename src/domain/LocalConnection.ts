import { Connection } from '@/domain/Connection'
import { ConnectionConfig } from '@/domain/types/config'

export default class LocalConnection extends Connection {
  private static instance: LocalConnection

  constructor(options: ConnectionConfig) {
    super(options)
  }

  static getInstance() {
    if (!LocalConnection.instance) {
      this.instance = new LocalConnection({
        id: 'local',
        name: 'local',
        is_remote: false,
        dbs: []
      })
    }
    return this.instance
  }
}
