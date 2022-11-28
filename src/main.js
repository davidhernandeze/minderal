import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace',
      component: () => import('@/components/Workspace.vue'),
      props: true
    }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')
