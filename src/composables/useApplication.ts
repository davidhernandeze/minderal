import { inject, ref } from 'vue'
import { Application } from '@/domain/Application'
import { Tab } from '@/domain/Tab'
import { Connection } from '@/domain/Connection'

export default () => {
  const app: Application = inject('app')
  const tabs = ref<Tab[]>(Array.from(app.tabs.values()))
  const connections = ref<Connection[]>(Array.from(app.connections.values()))

  app.on('tabs:changed', (newTabs) => {
    tabs.value = newTabs
  })
  app.on('connections:changed', (newConnections) => {
    console.log('newConnections', newConnections)
    connections.value = newConnections
  })

  return {
    connections,
    tabs
  }
}
