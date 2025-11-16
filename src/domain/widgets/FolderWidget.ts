import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'

export class FolderWidget extends Widget {
  key = 'folder'
  expandedComponent: string = 'FolderExpanded'
  showMainInput: boolean = true

  constructor(db: Database, doc: WidgetDocStructure) {
    super(db, doc)
  }
}
