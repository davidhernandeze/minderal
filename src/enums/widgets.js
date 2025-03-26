export const widgets = {
  text: {
    label: 'Text',
    icon: 'bi bi-text-paragraph',
    indexContent: (doc) => doc.content,
    previewComponent: 'Text',
    expandedComponent: 'TextExpanded',
    expandable: false,
    showMainInput: false,
    createWithContent: true,
    toClipboard: (doc) => doc.content
  },
  folder: {
    label: 'Folder',
    icon: 'bi bi-folder',
    expandable: true,
    baseDir: 'Folder',
    expandedComponent: 'FolderExpanded',
    previewComponent: 'FolderPreview',
    showMainInput: true,
    standalonePreview: true,
    hideCopyButton: true
  },
  url: {
    label: 'Url',
    icon: 'bi bi-link',
    indexContent: (doc) => {
      return JSON.stringify(doc.content)
    },
    previewComponent: 'UrlPreview',
    expandedComponent: 'UrlPreview',
    formComponent: 'UrlForm',
    toClipboard: (doc) => doc.content.url
  },
  switch: {
    label: 'Switch',
    icon: 'bi bi-toggle-on',
    defaultContent: false,
    previewComponent: 'Switch',
    expandedComponent: 'Switch'
  },
  audio: {
    label: 'Audio',
    icon: 'bi bi-mic',
    previewComponent: 'Text'
  },
  counter: {
    label: 'Counter',
    icon: 'bi bi-plus-slash-minus',
    previewComponent: 'Counter',
    expandedComponent: 'Counter',
    expandable: false,
    defaultContent: 0
  },
  countdown: {
    label: 'Countdown',
    icon: 'bi bi-hourglass',
    previewComponent: 'Text'
  },
  checklist: {
    label: 'Checklist',
    icon: 'bi bi-list-check',
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChecklistPreview',
    expandedComponent: 'ChecklistExpanded'
  },
  chat: {
    label: 'Chat',
    icon: 'bi bi-chat',
    standalonePreview: true,
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChatPreview',
    expandedComponent: 'ChatExpanded'
  },
  display: {
    label: 'Display',
    icon: 'bi bi-display',
    expandable: true,
    formComponent: 'DisplayForm',
    previewComponent: 'DisplayPreview',
    expandedComponent: 'DisplayExpanded'
  },
  image: {
    label: 'Image',
    icon: 'bi bi-card-image',
    expandable: true,
    formComponent: 'ImageForm',
    previewComponent: 'ImagePreview',
    expandedComponent: 'ImageExpanded'
  },
  file: {
    label: 'File',
    icon: 'bi bi-file-earmark',
    expandable: true,
    formComponent: 'FileForm',
    previewComponent: 'FilePreview',
    expandedComponent: 'FileExpanded'
  },
  command: {
    label: 'Command',
    icon: 'bi bi-terminal',
    indexContent: (doc) => doc.content,
    previewComponent: 'CommandPreview',
    expandedComponent: 'CommandPreview',
    expandable: false,
    createWithContent: true,
    toClipboard: (doc) => doc.content
  },
  coordinates: {
    label: 'Coordinates',
    icon: 'bi bi-geo-alt',
    indexContent: (doc) => doc.content,
    previewComponent: 'CoordinatesPreview',
    formComponent: 'CoordinatesForm',
    expandable: false,
    toClipboard: (doc) => `${doc.content.latitude},${doc.content.longitude}`
  },
  date: {
    label: 'Date',
    icon: 'bi bi-clock',
    indexContent: (doc) => doc.content,
    previewComponent: 'DatePreview',
    formComponent: 'DateForm',
    expandable: false,
    toClipboard: (doc) => `${doc.content.latitude},${doc.content.longitude}`
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
  return Object.keys(widgets).find((key) => widgets[key] === widget)
}
