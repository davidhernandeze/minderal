import PouchDB from 'pouchdb-browser'
import find from 'pouchdb-find'
import { readonly, ref } from 'vue'

PouchDB.plugin(find)

const currentDatabase = ref(null)
let databaseInstance

function selectDatabase (database) {
  currentDatabase.value = database
  databaseInstance = new PouchDB(database.id)
}

export default () => {
  const docs = ref([])
  const selectedDoc = ref(null)

  async function getDocs (parentId) {
    const allDocs = await databaseInstance.find({
      selector: { parent_id: parentId ?? false }
    })
    docs.value = allDocs.docs.sort((a, b) => a.order > b.order ? 1 : -1)
  }

  async function createDoc (value) {
    const docsLength = docs.value.length
    await databaseInstance.post({
      value,
      parent_id: selectedDoc.value?._id ?? false,
      order: docsLength ? docs.value[docsLength - 1].order + 100 : 0
    })
    await getDocs()
  }

  async function deleteDoc (doc) {
    await databaseInstance.remove(doc)
    await getDocs()
  }

  return {
    currentDatabase: readonly(currentDatabase),
    selectDatabase,
    docs,
    selectedDoc,
    getDocs,
    createDoc,
    deleteDoc
  }
}
