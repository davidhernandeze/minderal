import { v4 as generateId } from 'uuid'
import { TabConfig } from '@/domain/types/config'
import { Database } from '@/domain/Database'
import { Workspace } from '@/domain/Workspace'

export class Tab {
  id: string
  docId: string
  db: Database
  connectionName: string
  icon: string = 'folder'
  workspace: Workspace
  label: string = ''

  constructor(
    db: Database,
    config: TabConfig | { id?: string; doc_id?: string; is_open?: boolean }
  ) {
    this.id = config.id ?? generateId()
    this.db = db
    this.connectionName = db.getConnectionName()
    this.docId = config?.doc_id ?? 'root'
    this.workspace = new Workspace(db, this.docId)

    this.workspace.on('expandedWidget:changed', (widget) => {
      this.label = widget.name
    })
  }

  getConfig(): TabConfig {
    return {
      id: this.id,
      connection_id: this.db.getConnectionId(),
      doc_id: this.docId,
      database_name: this.db.name
    }
  }
}
