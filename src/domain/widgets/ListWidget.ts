import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  key = 'list'
  label: string = 'List'
  saved: boolean = false
  expandable: boolean = true
  readonly parentable: boolean = true
  expandedComponent: string = 'FolderExpanded'
  previewComponent: string = 'ListPreview'
  standalonePreview: boolean = true

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getAvailableSettings(): Array<{ name: string; type: string; label: string }> {
    return [{ name: 'children_type', type: 'widget', label: 'Items type' }]
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'children_type', type: 'widget', label: 'Items type' }
      ]
    }
  }

  updateDocFromForm(form): void {
    this.doc.name = form.name
    this.doc.settings.children_type = form.children_type
  }
}
