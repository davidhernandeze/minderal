export const widgets = {
  text: {
    label: 'Text',
    icon: 'fa-solid fa-align-left',
    indexContent: true,
    previewComponent: 'Text',
    expandedComponent: 'TextExpanded',
    expandable: false,
    showMainInput: false,
    createWithContent: true
  },
  folder: {
    label: 'Folder',
    icon: 'fa-solid fa-folder',
    indexContent: false,
    expandable: true,
    baseDir: 'Folder',
    expandedComponent: 'FolderExpanded',
    previewComponent: 'FolderPreview',
    showMainInput: true,
    standalonePreview: true
  },
  link: {
    label: 'Link',
    icon: 'fa-solid fa-link',
    indexContent: true,
    previewComponent: 'Text'
  },
  switch: {
    label: 'Switch',
    icon: 'fa-solid fa-toggle-on',
    indexContent: false,
    defaultContent: false,
    previewComponent: 'Switch',
    standalonePreview: true
  },
  audio: {
    label: 'Audio',
    icon: 'fa-solid fa-microphone',
    indexContent: false,
    previewComponent: 'Text'
  },
  counter: {
    label: 'Counter',
    icon: 'fa-solid fa-plus-minus',
    indexContent: false,
    previewComponent: 'Text'
  },
  countdown: {
    label: 'Countdown',
    icon: 'fa-solid fa-hourglass-half',
    indexContent: false,
    previewComponent: 'Text'
  },
  checklist: {
    label: 'Checklist',
    icon: 'fa-solid fa-list-check',
    indexContent: false,
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChecklistPreview',
    expandedComponent: 'ChecklistExpanded'
  },
  chat: {
    label: 'Chat',
    icon: 'fa-solid fa-messages',
    indexContent: false,
    standalonePreview: true,
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChatPreview',
    expandedComponent: 'ChatExpanded'
  },
  display: {
    label: 'Display',
    icon: 'fa-solid fa-presentation-screen',
    indexContent: true,
    expandable: true,
    previewComponent: 'DisplayPreview',
    expandedComponent: 'DisplayExpanded'
  },
  image: {
    label: 'Image',
    icon: 'fa-solid fa-image',
    indexContent: true,
    expandable: true,
    formComponent: 'ImageForm',
    previewComponent: 'ImagePreview',
    expandedComponent: 'ImageExpanded'
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

export const getWidgetKey = (widget) => {
  return Object.keys(widgets).find(key => widgets[key] === widget)
}
