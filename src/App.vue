<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, provide } from 'vue'
import themeStore from '@/stores/theme.js'
import { Application } from '@/domain/Application'
import { Toast, ConfirmDialog } from 'primevue'

const path = location.pathname

const MainComponent = defineAsyncComponent(() => {
  if (path === '/mindbar') {
    return import('@/layouts/Mindbar.vue')
  }
  if (path === '/v3') {
    return import('@/layouts/AppTS.vue')
  }
  if (path === '/v4') {
    return import('@/layouts/AppV4.vue')
  }

  return import('@/layouts/Default.vue')
})

const app: Application = new Application()
provide('app', app)

onBeforeMount(async () => {
  await app.initialize()
  themeStore.setDarkTheme()
})
</script>
<template>
  <Toast />
  <ConfirmDialog />
  <MainComponent />
</template>

<style>
html {
  font-family: 'Selawk', serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  border-radius: 0.375rem;
  font-size: 14px;
  background-color: var(--p-surface-50);
  user-select: none;
}

html.dark {
  background-color: var(--p-surface-900);
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawk.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawkl.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawkb.ttf') format('truetype');
  font-weight: 700; /* Bold weight */
  font-style: normal; /* Normal style */
}

@font-face {
  font-family: 'Nunito Regular';
  src: url('assets/fonts/Nunito-Regular.ttf');
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #1f2937 transparent;
}

/* Chrome, Edge, and Safari */
*::-webkit-scrollbar {
  width: 5px;
}

*::-webkit-scrollbar-track {
  background: #2c394a;
  border-radius: 5px;
}

*::-webkit-scrollbar-thumb {
  background-color: #1f2937;
}

pwa-camera-modal-instance {
  z-index: 9999;
}
</style>
