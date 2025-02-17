import Quill from 'quill'

export const widgets = {
  text: {
    label: 'Text',
    icon: 'fa-solid fa-align-left',
    indexContent: (doc) => {
      return (
        doc.content?.ops?.reduce((acc, op) => {
          return acc + op.insert
        }, '') ?? ''
      )
    },
    toClipboard(doc) {
      const quill = new Quill(document.createElement('div'))
      quill.setContents(doc.content)
      return quill.getText()
    },
    previewComponent: 'Text',
    expandedComponent: 'TextExpanded',
    expandable: false,
    showMainInput: false,
    createWithContent: true,
  },
  folder: {
    label: 'Folder',
    icon: 'fa-solid fa-folder',
    expandable: true,
    baseDir: 'Folder',
    expandedComponent: 'FolderExpanded',
    previewComponent: 'FolderPreview',
    showMainInput: true,
    standalonePreview: true,
    hideCopyButton: true,
  },
  url: {
    label: 'Url',
    icon: 'fa-solid fa-link',
    indexContent: (doc) => {
      return JSON.stringify(doc.content)
    },
    previewComponent: 'UrlPreview',
    expandedComponent: 'UrlPreview',
    formComponent: 'UrlForm',
    toClipboard: (doc) => doc.content.url,
  },
  switch: {
    label: 'Switch',
    icon: 'fa-solid fa-toggle-on',
    defaultContent: false,
    previewComponent: 'Switch',
    expandedComponent: 'Switch',
  },
  audio: {
    label: 'Audio',
    icon: 'fa-solid fa-microphone',
    previewComponent: 'Text',
  },
  counter: {
    label: 'Counter',
    icon: 'fa-solid fa-plus-minus',
    previewComponent: 'Counter',
    expandedComponent: 'Counter',
    expandable: false,
    defaultContent: 0,
  },
  countdown: {
    label: 'Countdown',
    icon: 'fa-solid fa-hourglass-half',
    previewComponent: 'Text',
  },
  checklist: {
    label: 'Checklist',
    icon: 'fa-solid fa-list-check',
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChecklistPreview',
    expandedComponent: 'ChecklistExpanded',
  },
  chat: {
    label: 'Chat',
    icon: 'fa-solid fa-messages',
    standalonePreview: true,
    expandable: true,
    defaultContent: [],
    previewComponent: 'ChatPreview',
    expandedComponent: 'ChatExpanded',
  },
  display: {
    label: 'Display',
    icon: 'fa-solid fa-presentation-screen',
    expandable: true,
    previewComponent: 'DisplayPreview',
    expandedComponent: 'DisplayExpanded',
  },
  image: {
    label: 'Image',
    icon: 'fa-solid fa-image',
    expandable: true,
    formComponent: 'ImageForm',
    previewComponent: 'ImagePreview',
    expandedComponent: 'ImageExpanded',
  },
  command: {
    label: 'Command',
    icon: 'fa-solid fa-square-terminal',
    indexContent: (doc) => doc.content,
    previewComponent: 'CommandPreview',
    expandedComponent: 'CommandPreview',
    expandable: false,
    createWithContent: true,
  },
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
