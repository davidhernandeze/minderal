export const widgets = {
  text: {
    label: 'Text',
    icon: 'fa-solid fa-align-left',
    indexValue: true,
    previewComponent: 'Text.vue'
  },
  folder: {
    label: 'Folder',
    icon: 'fa-solid fa-folder',
    indexValue: false,
    hidePreviewHeader: true,
    expandable: true,
    expandedComponent: 'Folder/FolderExpanded.vue',
    previewComponent: 'Folder/FolderPreview.vue',
    showMainInput: true
  },
  link: {
    label: 'Link',
    icon: 'fa-solid fa-link',
    indexValue: true,
    previewComponent: 'Text.vue'
  },
  switch: {
    label: 'Switch',
    icon: 'fa-solid fa-toggle-on',
    indexValue: false,
    defaultValue: false,
    hideHeader: true,
    previewComponent: 'Switch.vue'
  },
  audio: {
    label: 'Audio',
    icon: 'fa-solid fa-microphone',
    indexValue: false,
    previewComponent: 'Text.vue'
  },
  counter: {
    label: 'Counter',
    icon: 'fa-solid fa-plus-minus',
    indexValue: false,
    previewComponent: 'Text.vue'
  },
  countdown: {
    label: 'Countdown',
    icon: 'fa-solid fa-hourglass-half',
    indexValue: false,
    previewComponent: 'Text.vue'
  },
  todo: {
    label: 'To-do',
    icon: 'fa-solid fa-list-check',
    indexValue: false,
    expandable: true,
    defaultValue: [],
    previewComponent: 'Todo/TodoPreview.vue',
    expandedComponent: 'Todo/TodoExpanded.vue'
  }
}

export const getWidgetList = () => {
  return Object.entries(widgets).map((type) => {
    return { index: type[0], ...type[1] }
  })
}

export const getWidgetProps = (name) => {
  return widgets[name]
}
