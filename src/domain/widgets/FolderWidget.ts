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
  readonly parentable: boolean = true
  expandedComponent: string = 'FolderExpanded'
  previewComponent: string = 'FolderPreview'
  standalonePreview: boolean = true

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'icon', type: 'icon', required: true, default: 'folder', label: 'Icon' }
      ]
    }
  }

  getFormValues(): Record<string, unknown> {
    return {
      name: this.doc.name,
      icon: this.doc.settings?.icon ?? 'folder'
    }
  }

  updateDocFromForm(form): void {
    this.doc.name = form.name
    this.doc.settings.icon = form.icon
  }
}
