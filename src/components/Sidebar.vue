<template>
  <transition name="slide">
    <div
      class="z-50 fixed w-full sm:w-1/3 sm:relative xl:w-2/12 h-screen shadow-lg sm:text-xs"
      style="background-color: #2C3339"
      v-show="$store.state.workspace.isSidebarVisible"
    >
      <div style="font-size: 0.9em">
        <context-menu ref="folderMenu" :model="folderOptions"/>
      </div>
      <div class="flex items-center p-3 border-b border-gray-900">
        <div class="w-5 h-5 mr-3 bg-green-400 cursor-pointer rounded-full flex justify-center items-center"/>
        <div class="truncate">
          {{ username }}
        </div>
        <icon class="ml-1" icon="chevron-down"></icon>
        <div class="flex-1 flex justify-end ml-2">
          <icon icon="search"></icon>
        </div>
      </div>
      <div class="p-3">
        <div
          @click="$store.dispatch('openDocumentInTab', { tabIndex: $store.state.workspace.currentTabIndex, documentId: 'index' })"
          @contextmenu="openFolderMenu($event, 'index')"
          class="text-xss mb-2 cursor-pointer"
        >
          <icon icon="home"/>
          MAIN
        </div>
<!--        <sidebar-folder-->
<!--          v-for="document in $store.state.workspace.documentTree['index']"-->
<!--          :key="document._id"-->
<!--          @contextmenu="openFolderMenu"-->
<!--          :document="document"-->
<!--          :depth="0"-->
<!--        />-->
      </div>
    </div>
  </transition>
</template>

<script setup>
// import ContextMenu from 'primevue/contextmenu'
import { isSidebarVisible } from '../composables/useWorkspace.js'

const hola = 'asd';
</script>

<style lang="scss">
  /* Enter and leave animations can use different */
  /* durations and timing functions.              */
  .slide-enter-active {
    transition: all .3s ease;
  }
  .slide-leave-active {
    transition: all .3s ease;
  }
  .slide-enter, .slide-leave-to {
    transform: translateX(-100%);
    position: absolute;
  }

  .p-contextmenu {
    padding: 0.25em 0;
    width: 12.5em;
  }
   .p-component {
     font-size: 1em;
     .pi {
       font-size: 1em;
     }
   }
</style>
