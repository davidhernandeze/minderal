import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'

export default class extends Widget {
  key = 'folder'
  icon = 'bi bi-text-paragraph'
  expandedComponent: string = 'TextExpanded'
  previewComponent: string = 'Text'
  showMainInput: boolean = true

  constructor(db: Database, doc: WidgetDocStructure) {
    super(db, doc)
  }

  getContent() {
    return this.doc.content
  }
}
