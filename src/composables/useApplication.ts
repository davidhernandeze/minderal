import { inject, ref } from 'vue'
import { Database } from '@/domain/Database'
import { Application } from '@/domain/Application'
import { Tab } from '@/domain/Tab'

export default () => {
  const app: Application = inject('app')
  const dbs = ref<Database[]>(Array.from(app.dbs.values()))
  const tabs = ref<Tab[]>(Array.from(app.tabs.values()))

  app.on('dbs:changed', (newDocs) => {
    dbs.value = Array.from(newDocs.values())
  })

  app.on('tabs:changed', (newTabs) => {
    tabs.value = Array.from(newTabs.values())
  })

  return {
    dbs,
    tabs
  }
}
