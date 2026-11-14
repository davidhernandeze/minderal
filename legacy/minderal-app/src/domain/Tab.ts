import { v4 as generateId } from 'uuid'
import { TabConfig } from '@/domain/types/config'
import { Database } from '@/domain/Database'
import { Workspace } from '@/domain/Workspace'
import { Widget } from '@/domain/Widget'
import { Application } from '@/domain/Application'

type FlexibleTabConfig = TabConfig | { id?: string; doc_id?: string; is_open?: boolean }

export class Tab {
  id: string
  docId: string
  db: Database
  connectionName: string
  icon: string = 'folder'
  workspace: Workspace
  label: string = ''
  isFirstNavigation = true

  private constructor(app: Application, db: Database, config: FlexibleTabConfig) {
    this.id = config.id ?? generateId()
    this.db = db
    this.connectionName = db.getConnectionName()
    this.docId = config?.doc_id ?? 'root'
    this.workspace = new Workspace(db, this.docId)

    this.workspace.on('expandedWidget:changed', async (widget: Widget) => {
      this.label = widget.doc.name
      this.docId = widget.doc._id
      if (this.isFirstNavigation) {
        this.isFirstNavigation = false
        return
      }
      await app.updateConfigDocument()
    })
  }

  static async createFromConfig(
    app: Application,
    db: Database,
    config: FlexibleTabConfig
  ): Promise<Tab> {
    const newTab = new Tab(app, db, config)
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
