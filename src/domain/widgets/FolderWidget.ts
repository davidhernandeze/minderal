import { Widget } from '@/domain/Widget'

export class FolderWidget extends Widget {
  public key = 'folder'
  expandedComponent: string = 'FolderExpanded'
}
