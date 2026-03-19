import { DocStructure } from '@/domain/interfaces/DocStructure'

export interface TagDocStructure extends DocStructure {
  label: string
  usage: number
}
