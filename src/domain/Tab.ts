import { v4 as generateId } from 'uuid'
import { TabConfig } from '@/domain/types/config'
import { Database } from '@/domain/Database'
import { Workspace } from '@/domain/Workspace'

export class Tab {
  id: string
  connectionName: string
  icon: string = 'folder'
  isOpen: boolean
  workspace: Workspace

  constructor(
    public db: Database,
    public docId: string = ''
  ) {
    this.id = generateId()
    this.connectionName = db.getConnectionName()
    this.workspace = new Workspace(db, docId)
  }

  getConfig(): TabConfig {
    return {
      id: this.id,
      connection_id: this.db.getConnectionId(),
      doc_id: this.docId,
      database_name: this.db.name
    }
  }

  setDocId(docId: string) {
    this.docId = docId
  }
}
