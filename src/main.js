import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Modal from '@/components/Modal.vue'
import { createPinia } from 'pinia'
import find from 'pouchdb-find'
import PouchDB from 'pouchdb-browser'

PouchDB.plugin(find)

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
app.component('Modal', Modal)

window.onkeydown = function (key) {
  if (key.ctrlKey && key.key.toLowerCase() === 'k') {
    key.preventDefault()
  }
}
