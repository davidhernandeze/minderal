import { v4 as generateId } from 'uuid'
import { TabConfig } from '@/domain/types/config'
import { Database } from '@/domain/Database'
import { Workspace } from '@/domain/Workspace'

export class Tab {
  id: string
  docId: string = ''
  db: Database
  connectionName: string
  icon: string = 'folder'
  isOpen: boolean
  workspace: Workspace

  constructor(db: Database, config: TabConfig) {
    this.id = generateId()
    this.db = db
    this.connectionName = db.getConnectionName()
    this.docId = config?.doc_id ?? ''
    this.isOpen = config?.is_open ?? false
    this.workspace = new Workspace(db, this.docId)
  }

  getConfig(): TabConfig {
    return {
      id: this.id,
      connection_id: this.db.getConnectionId(),
      doc_id: this.docId,
      database_name: this.db.name,
      is_open: this.isOpen
    }
  }
}
