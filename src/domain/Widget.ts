import { Database } from '@/domain/Database'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'

export class Widget {
  private children: Widget[] = []
  private db: Database
  private doc: WidgetDocStructure

  constructor(db: Database, doc: WidgetDocStructure) {
    this.db = db
    this.doc = doc
  }

  getChildren() {
    return []
  }
}
