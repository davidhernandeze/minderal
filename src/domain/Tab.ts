import { v4 as generateId } from 'uuid'
import { TabConfig } from '@/domain/types/config'
import { Database } from '@/domain/Database'
import { Workspace } from '@/domain/Workspace'

type FlexibleTabConfig = TabConfig | { id?: string; doc_id?: string; is_open?: boolean }

export class Tab {
  id: string
  docId: string
  db: Database
  connectionName: string
  icon: string = 'folder'
  workspace: Workspace
  label: string = ''

  private constructor(db: Database, config: FlexibleTabConfig) {
    this.id = config.id ?? generateId()
    this.db = db
    this.connectionName = db.getConnectionName()
    this.docId = config?.doc_id ?? 'root'
    this.workspace = new Workspace(db, this.docId)

    this.workspace.on('expandedWidget:changed', (widget) => {
      this.label = widget.doc.name
    })
  }

  static async createFromConfig(db: Database, config: FlexibleTabConfig): Promise<Tab> {
    const newTab = new Tab(db, config)
    await newTab.workspace.navigateToWidget(newTab.docId)
    return newTab
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
