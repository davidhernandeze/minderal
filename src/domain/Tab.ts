import { v4 as generateId } from 'uuid'
import { Widget } from '@/domain/Widget'
import { Connection } from '@/domain/Connection'
import { TabConfig } from '@/domain/types/config'

export class Tab {
  id: string
  isOpen: boolean

  constructor(
    public connection: Connection,
    public docId: string = ''
  ) {
    this.id = generateId()
  }

  getConfig(): TabConfig {
    return {
      id: this.id,
      connection_id: this.connection.id,
      doc_id: this.docId
    }
  }
}
