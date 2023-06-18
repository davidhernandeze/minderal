import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import find from 'pouchdb-find'
import PouchDB from 'pouchdb-browser'

PouchDB.plugin(find)

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace',
      component: () => import('@/components/Workspace2.vue'),
      props: true
    },
    {
      path: '/rtc',
      name: 'rtc',
      component: () => import('@/components/WebRTCSettings.vue')
    }
  ]
})

const app = createApp(App)
const pinia = createPinia()
app.use(router)
app.use(pinia)
app.mount('#app')

window.onkeydown = function (key) { if (key.ctrlKey === true) { key.preventDefault() } }
