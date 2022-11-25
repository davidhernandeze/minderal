import { reactive } from 'vue'
import PouchDB from 'pouchdb-browser'
import { v4 as getId } from 'uuid'

let instance

function selectDatabase (id) {
  instance = new PouchDB(id)
}

function createDatabase (name) {
  const id = getId()
  new PouchDB(id)
  const databases = getDatabases()
  databases.push({ id, name })
  localStorage.setItem('local_databases', JSON.stringify(databases))
}

function getDatabases () {
  return JSON.parse(localStorage.getItem('local_databases')) ?? []
}

async function getAllDocs () {
  const allDocs = await instance.allDocs({ include_docs: true })
  return allDocs.rows.map((doc) => doc.doc).sort((a, b) => a.order > b.order ? 1 : -1)
}

async function storeNewDoc (doc) {
  await instance.post(doc)
}

async function deleteDoc (doc) {
  await instance.remove(doc)
}

export default reactive({
  selectDatabase,
  getDatabases,
  createDatabase,
  getAllDocs,
  storeNewDoc,
  deleteDoc
})
