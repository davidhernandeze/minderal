import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Modal from '@/components/Modal.vue'
import { createPinia } from 'pinia'
import find from 'pouchdb-find'
import PouchDB from 'pouchdb-browser'
import PrimeVue from 'primevue/config'

PouchDB.plugin(find)

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(PrimeVue, { theme: 'none' })
app.mount('#app')
app.component('Modal', Modal)

window.onkeydown = function (key) {
  if (key.ctrlKey && key.key.toLowerCase() === 'k') {
    key.preventDefault()
  }
}
