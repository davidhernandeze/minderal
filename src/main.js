import { createApp } from 'vue'
import 'quill/dist/quill.core.css'
import 'quill/dist/quill.bubble.css'
import 'highlight.js/styles/atom-one-dark.css'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import find from 'pouchdb-find'
import PouchDB from 'pouchdb-browser'
import * as Sentry from '@sentry/vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import FocusTrap from 'primevue/focustrap'
import Tooltip from 'primevue/tooltip'
import ConfirmationService from 'primevue/confirmationservice'
import { defineCustomElements } from '@ionic/pwa-elements/loader'
import { registerSW } from 'virtual:pwa-register'

defineCustomElements(window)

registerSW({ immediate: true })

PouchDB.plugin(find)

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark'
    }
  }
})
app.directive('focustrap', FocusTrap)
app.directive('tooltip', Tooltip)
app.use(ConfirmationService)

// eslint-disable-next-line no-undef
if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    app,
    dsn: 'https://08d470a3d023b85f1945caa859f33907@o4506906515406848.ingest.us.sentry.io/4506906544242688'
  })
}

app.mount('#app')

window.onkeydown = function (key) {
  if (key.ctrlKey && key.key.toLowerCase() === 'k') {
    key.preventDefault()
  }
}
