import PouchDB from 'pouchdb-browser'
import { v4 as getId } from 'uuid'
import { ref } from 'vue'

const metaDatabase = new PouchDB('minderal')
const metaDoc = ref(null)

let current

function selectDatabase (id) {
  current = new PouchDB(id)
}

async function createDatabase (name) {
  const id = getId()
  new PouchDB(id)
  metaDoc.value.local_dbs.push({ id, name })
  await metaDatabase.put(metaDoc.value)
}

async function deleteDatabase (id) {
  await new PouchDB(id).destroy()
  metaDoc.value.local_dbs = metaDoc.value.local_dbs.filter((db) => db.id !== id)
  await metaDatabase.put(metaDoc.value)
}

async function initMetaDoc () {
  if (metaDoc.value) return
  metaDoc.value = await getOrCreateDoc(metaDatabase, 'meta')
  metaDatabase.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', (change) => {
    if (change.id !== 'meta') return
    metaDoc.value = change.doc
  })
}

async function getOrCreateDoc (database, id) {
  try {
    return await database.get(id)
  } catch (e) {
    if (e.status !== 404) return null
    await metaDatabase.put({ _id: 'meta', local_dbs: [] })
    return await metaDatabase.get(id)
  }
}

async function init () {
  await initMetaDoc()
}

async function getAllDocs () {
  const allDocs = await current.allDocs({ include_docs: true })
  return allDocs.rows.map((doc) => doc.doc).sort((a, b) => a.order > b.order ? 1 : -1)
}

async function storeNewDoc (doc) {
  await current.post(doc)
}

async function deleteDoc (doc) {
  await current.remove(doc)
}

export default {
  metaDoc,
  init,
  selectDatabase,
  createDatabase,
  deleteDatabase,
  getAllDocs,
  storeNewDoc,
  deleteDoc
}
