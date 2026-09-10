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
  expandedComponent: string = 'ListExpanded'
  previewComponent: string = 'ListPreview'
  standalonePreview: boolean = true

  constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super(db, doc, widgetFactory)
  }

  getParentableSettings(): Array<{ name: string; type: string; label: string }> {
    return [
      { name: 'children_type', type: 'widget', label: 'Items type' },
      { name: 'children_type_locked', type: 'checkbox', label: 'Lock items type' }
    ]
  }

  getFormStructure(): FormStructure {
    return {
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'settings.children_type', type: 'widget', label: 'Items type' },
        {
          name: 'settings.children_type_locked',
          type: 'checkbox',
          label: 'Lock items type',
          default: false
        }
      ]
    }
  }
}
