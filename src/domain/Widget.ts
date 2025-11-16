import { Database } from '@/domain/Database'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'

export class Widget {
  name: string
  private children: Widget[] = []
  private db: Database
  private doc: WidgetDocStructure
  public showMainInput: boolean

  constructor(db: Database, doc: WidgetDocStructure) {
    this.db = db
    this.doc = doc
    this.name = doc.name
  }

  getChildren() {
    return []
  }
}
