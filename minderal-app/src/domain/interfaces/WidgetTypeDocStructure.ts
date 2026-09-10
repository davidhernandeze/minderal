import { DocStructure } from '@/domain/interfaces/DocStructure'

export interface WidgetTypeTemplateEntry {
  widget_type: string
  name?: string
}

export interface WidgetTypeDocStructure extends DocStructure {
  label: string
  primitive: string
  settings?: object
  template?: WidgetTypeTemplateEntry[]
  icon: string
}
