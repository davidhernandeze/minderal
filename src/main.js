import { createApp } from 'vue'
import 'quill/dist/quill.core.css'
import 'quill/dist/quill.bubble.css'
import './style.css'
import App from './App.vue'
import Modal from '@/components/Modal.vue'
import { createPinia } from 'pinia'
import find from 'pouchdb-find'
import PouchDB from 'pouchdb-browser'
import * as Sentry from '@sentry/vue'

PouchDB.plugin(find)

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    app,
    dsn: 'https://08d470a3d023b85f1945caa859f33907@o4506906515406848.ingest.us.sentry.io/4506906544242688'
  })
}

app.mount('#app')
app.component('Modal', Modal)

window.onkeydown = function (key) {
  if (key.ctrlKey && key.key.toLowerCase() === 'k') {
    key.preventDefault()
  }
}
