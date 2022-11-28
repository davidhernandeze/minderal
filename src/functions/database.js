
export async function getOrCreateDoc (database, id) {
  try {
    return await database.get(id)
  } catch (e) {
    if (e.status !== 404) return null
    await database.put({ _id: id })
    return await database.get(id)
  }
}
