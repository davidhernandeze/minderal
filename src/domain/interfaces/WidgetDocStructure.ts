import { DocStructure } from '@/domain/interfaces/DocStructure'

export interface WidgetDocStructure extends DocStructure {
  parent_id: string
  name: string
  content: string
  widget: string
  settings: object
  created_by: string
  deleted_at: string | null
  files?: object[]
}
