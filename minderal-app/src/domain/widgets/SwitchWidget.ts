import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  key = 'switch'
  label: string = 'Switch'
  saved: boolean = false
  expandable: boolean = true
  previewComponent: string = 'SwitchPreview'
  standalonePreview: boolean = false

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'content', type: 'checkbox', label: 'Checked' }
      ]
    }
  }

  getContent() {
    return !!this.doc.content
  }

  updateDocFromForm(form): void {
    super.updateDocFromForm(form)
    this.doc.name = form.name
    this.doc.content = form.content
  }
}
