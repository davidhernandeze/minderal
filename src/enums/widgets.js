export const widgets = {
  text: {
    label: 'Text',
    icon: 'fa-solid fa-align-left',
    indexValue: true,
    previewComponent: 'Text',
    expandedComponent: 'TextExpanded',
    expandable: true,
    showMainInput: false
  },
  folder: {
    label: 'Folder',
    icon: 'fa-solid fa-folder',
    indexValue: false,
    hidePreviewHeader: true,
    expandable: true,
    baseDir: 'Folder',
    expandedComponent: 'FolderExpanded',
    previewComponent: 'FolderPreview',
    showMainInput: true
  },
  link: {
    label: 'Link',
    icon: 'fa-solid fa-link',
    indexValue: true,
    previewComponent: 'Text'
  },
  switch: {
    label: 'Switch',
    icon: 'fa-solid fa-toggle-on',
    indexValue: false,
    defaultValue: false,
    hideHeader: true,
    previewComponent: 'Switch'
  },
  audio: {
    label: 'Audio',
    icon: 'fa-solid fa-microphone',
    indexValue: false,
    previewComponent: 'Text'
  },
  counter: {
    label: 'Counter',
    icon: 'fa-solid fa-plus-minus',
    indexValue: false,
    previewComponent: 'Text'
  },
  countdown: {
    label: 'Countdown',
    icon: 'fa-solid fa-hourglass-half',
    indexValue: false,
    previewComponent: 'Text'
  },
  checklist: {
    label: 'Checklist',
    icon: 'fa-solid fa-list-check',
    indexValue: false,
    expandable: true,
    defaultValue: [],
    previewComponent: 'ChecklistPreview',
    expandedComponent: 'ChecklistExpanded'
  },
  chat: {
    label: 'Chat',
    icon: 'fa-solid fa-messages',
    indexValue: false,
    hidePreviewHeader: true,
    expandable: true,
    defaultValue: [],
    previewComponent: 'ChatPreview',
    expandedComponent: 'ChatExpanded'
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
