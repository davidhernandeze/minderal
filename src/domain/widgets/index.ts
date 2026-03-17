import { Database, Widget, WidgetFactory } from '@/domain'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'

export interface WidgetTypeDefinition {
  key: string
  label: string
  icon: string
  showNameSelector?: boolean
  class: () => Promise<{
    default: new (db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) => Widget
  }>
}

// Widgets statically added to application
// each item contains info that we want to know without importing the widget class
export const staticWidgetTypes: WidgetTypeDefinition[] = [
  {
    key: 'list',
    label: 'List',
    icon: 'bi bi-list-ul',
    class: () => import('./ListWidget')
  },
  {
    key: 'folder',
    label: 'Folder',
    icon: 'bi bi-folder',
    class: () => import('./FolderWidget')
  },
  {
    key: 'text',
    label: 'Text',
    icon: 'bi bi-text-paragraph',
    showNameSelector: true,
    class: () => import('./TextWidget')
  },
  {
    key: 'checkbox',
    label: 'Checkbox',
    icon: 'bi bi-check-square',
    showNameSelector: false,
    class: () => import('./CheckboxWidget')
  },
  // {
  //   key: 'switch',
  //   label: 'Switch',
  //   icon: 'bi bi-toggle-on',
  //   class: () => import('./SwitchWidget')
  // },
  // {
  //   key: 'counter',
  //   label: 'Counter',
  //   icon: 'bi bi-plus-slash-minus',
  //   class: () => import('./CounterWidget')
  // },
  // {
  //   key: 'countdown',
  //   label: 'Countdown',
  //   icon: 'bi bi-hourglass',
  //   class: () => import('./CountdownWidget')
  // },
  {
    key: 'color',
    label: 'Color',
    icon: 'bi bi-palette',
    showNameSelector: true,
    class: () => import('./ColorWidget')
  }
]
