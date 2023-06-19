export const types = {
  text: {
    label: 'Text',
    icon: 'fa-solid fa-align-left',
    indexValue: true
  },
  folder: {
    label: 'Folder',
    icon: 'fa-solid fa-folder',
    indexValue: false
  },
  link: {
    label: 'Link',
    icon: 'fa-solid fa-link',
    indexValue: true
  },
  checkbox: {
    label: 'Checkbox',
    icon: 'fa-solid fa-square-check',
    indexValue: false
  },
  audio: {
    label: 'Audio',
    icon: 'fa-solid fa-microphone',
    indexValue: false
  }
}

export const getTypeList = () => {
  return Object.entries(types).map((type) => {
    return { index: type[0], ...type[1] }
  })
}
