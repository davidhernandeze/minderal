<template>
  <div>
    <div class="flex">
      <sidebar @change-document="documentId => loadDocument($store.state.workspace.currentTabIndex, documentId)"/>
      <sync-icon/>
      <div class="flex-1">
        <div
          class="flex w-full bg-red-400 text-xs hover:text-white"
          style="background-color: #3d454b"
        >
          <div
            v-for="(tab, index) in tabs"
            :key="tab.id"
            @click="$store.dispatch('changeActiveTab', index)"
            :class="{'border-b-2': $store.state.workspace.currentTabIndex === index}"
            class="px-3 py-1 flex items-center cursor-pointer border-green-400"
          >
            <span v-if="tab.document._id === 'index'"><icon size="xs" icon="home"/> Home</span>
            <span v-else>{{ tab.document.name }}</span>
            <icon
              icon="times"
              @click.stop="$store.dispatch('closeTab', index)"
              class="ml-2 text-xss text-gray-500 hover:text-white"
            />
          </div>
        </div>
        <div v-for="(tab, index) in tabs" :key="tab.id">
          <document
            v-if="$store.state.workspace.currentTabIndex === index"
            :document="tab.document"
            @change-document="documentId => loadDocument(index, documentId)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Document from '@/components/document/Document'
import Sidebar from '@/components/Sidebar'
import SyncIcon from '@/components/SyncIcon'
import { mapState } from 'vuex'

import { isUndefined } from 'lodash'

export default {
  components: {
    Document,
    Sidebar,
    SyncIcon
  },
  computed: {
    ...mapState({
      tabs: state => state.workspace.tabs
    })
  },
  async mounted () {
    let documentId = this.$route.params.id
    if (isUndefined(documentId)) documentId = 'index'
    if (this.documentId === 'index.html') documentId = 'index'
    await this.$store.dispatch('createDatabases')
    await this.$store.dispatch('startFirstSync')
    this.$store.state.database.firstSyncObject.on('complete', async () => {
      await this.$store.dispatch('openDocumentInANewTab', documentId)
      await this.$store.dispatch('loadDocumentTree', 'index')
      await this.$store.dispatch('startLiveSync')
    })
  },
  methods: {
    loadDocument (tabIndex, documentId) {
      this.$store.dispatch('openDocumentInTab', { tabIndex, documentId })
    }
  },
  watch: {
    $route (to, from) {
      this.loadDocument(0, to.params.id)
    }
  }
}
</script>
