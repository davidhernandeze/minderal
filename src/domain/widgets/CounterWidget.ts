import { Widget } from '@/domain/Widget'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { Database } from '@/domain'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'

export default class extends Widget {
  readonly key = 'counter'
  readonly label: string = 'Counter'
  readonly expandedComponent: string = 'Counter'
  readonly previewComponent: string = 'Counter'
  readonly standalonePreview: boolean = false
  readonly expandable: boolean = false

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'content', type: 'number', label: 'Initial value' }
      ]
    }
  }

  updateDocFromForm(form: { name: string; content: number }): void {
    this.doc.name = form.name
    this.doc.content = typeof form.content === 'number' ? form.content : 0
  }

  getContent(): number {
    const value = this.doc.content as unknown as number
    return typeof value === 'number' ? value : 0
  }
}
