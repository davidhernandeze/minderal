# minderal
Web based mental database manager

## Run web server
```commandline
npm run dev
```

## Build
```commandline
npm run build
```

## Notes
- About grouping same widget versions (expandable, preview) in a folder, that wasn't possible due to limitations on dynamic imports. https://vitejs.dev/guide/features#dynamic-import

## All docs migration
```js
    // Database.js constructor()
    this.connection.allDocs({ include_docs: true }).then((result) => {
      const migratedDocs = result.rows.map(row => {
        row.doc.deleted_at = null
        row.doc.content = row.value
        return row.doc
      })
      this.connection.bulkDocs(migratedDocs).then(() => {
        console.log('Database migration complete')
      })
    })
```
