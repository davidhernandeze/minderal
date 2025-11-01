import { Doc } from '@/domain/Doc'
import { ConnectionConfig, DatabaseConfig, TabConfig } from '@/domain/types/config'

export interface ConfigDoc extends Doc {
  connections: ConnectionConfig[]
  tabs: TabConfig[]
  dbs: DatabaseConfig[]
}
