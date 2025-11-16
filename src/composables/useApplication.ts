import { inject, ref } from 'vue'
import { Application } from '@/domain/Application'
import { Tab } from '@/domain/Tab'
import { Connection } from '@/domain/Connection'

export default () => {
  const app: Application = inject('app')
  const tabs = ref<Tab[]>(app.getTabs())
  const connections = ref<Connection[]>(app.getConnections())

  app.on('tabs:changed', (newTabs) => {
    tabs.value = newTabs
  })
  app.on('connections:changed', (newConnections) => {
    console.log('connection change', newConnections)
    connections.value = newConnections
  })

  return {
    app,
    connections,
    tabs
  }
}
