import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  key = 'folder'
  label: string = 'Folder'
  saved: boolean = false
  expandable: boolean = true
  static readonly parentable: boolean = true
  expandedComponent: string = 'ListExpanded'
  previewComponent: string = 'FolderPreview'
  standalonePreview: boolean = true

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'settings.icon', type: 'icon', required: false, default: null, label: 'Icon' }
      ]
    }
  }
}
