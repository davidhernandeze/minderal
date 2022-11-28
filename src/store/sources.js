import PouchDB from 'pouchdb-browser'
import { readonly, ref } from 'vue'
import { v4 as getId } from 'uuid'
import { getOrCreateDoc } from '@/functions/database.js'

const SOURCES_DOC_ID = 'sources'
const metaDatabase = new PouchDB('minderal')
const doc = ref(null)

async function initSourcesDoc () {
  doc.value = await getOrCreateDoc(metaDatabase, SOURCES_DOC_ID)
  if (!doc.value.sources) {
    doc.value.sources = [{
      id: 'local',
      name: 'Local',
      databases: [],
      is_local: true
    }]
  }
  metaDatabase.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', (change) => {
    if (change.id !== SOURCES_DOC_ID) return
    doc.value = change.doc
  })
  await metaDatabase.put(doc.value)
}

async function createDatabase (sourceIndex, name) {
  const id = getId()
  const newDatabase = new PouchDB(id)
  await newDatabase.createIndex({
    index: { fields: ['parent_id'] },
    ddoc: 'by_parent'
  })
  doc.value.sources[sourceIndex].databases.push({ id, name })
  console.log(doc.value)
  await metaDatabase.put(doc.value)
}

async function deleteDatabase (sourceIndex, id) {
  await new PouchDB(id).destroy()
  doc.value.sources[sourceIndex].databases = doc.value.sources[sourceIndex].databases.filter((db) => db.id !== id)
  await metaDatabase.put(doc.value)
}

initSourcesDoc()

export default {
  doc: readonly(doc),
  createDatabase,
  deleteDatabase
}
