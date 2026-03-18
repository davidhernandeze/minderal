import { DocStructure } from '@/domain/interfaces/DocStructure'

export type AllowedContentTypes = string | number | boolean | null | [] | object

export interface WidgetDocStructure extends DocStructure {
  parent_id: string
  name: string
  content: AllowedContentTypes
  widget: string
  settings: { [key: string]: AllowedContentTypes }
  created_by?: string
  deleted_at: string | null
  files?: object[]
}
