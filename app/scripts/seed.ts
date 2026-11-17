/**
 * Seed data for the dev cluster: plain documents until the neuron model lands. Deterministic, so every
 * reset shows the same dataset.
 */
const topics = ['Garden', 'Reading', 'Kitchen', 'Travel', 'Workshop', 'Music']
const verbs = ['Plan', 'Review', 'Sketch', 'Fix', 'Collect', 'Try']

export function seedDocuments(): ({ _id: string } & Record<string, unknown>)[] {
  const createdAt = Date.parse('2026-11-01T09:00:00Z')
  const neurons = Array.from({ length: 24 }, (_, index) => {
    const topic = topics[index % topics.length] ?? 'Misc'
    const verb = verbs[Math.floor(index / topics.length) % verbs.length] ?? 'Neuron'
    return {
      _id: `neuron:seed-${String(index + 1).padStart(2, '0')}`,
      type: 'neuron',
      title: `${verb} ${topic.toLowerCase()} ideas`,
      body: `Seeded neuron ${index + 1} about ${topic.toLowerCase()}.`,
      tags: [topic.toLowerCase(), index % 3 === 0 ? 'pinned' : 'inbox'],
      createdAt: new Date(createdAt + index * 3_600_000).toISOString(),
    }
  })
  const tasks = ['Water the tomatoes', 'Return library books', 'Sharpen the chisels', 'Book train tickets'].map((title, index) => ({
    _id: `task:seed-${index + 1}`,
    type: 'task',
    title,
    done: index % 2 === 1,
    createdAt: new Date(createdAt + index * 86_400_000).toISOString(),
  }))
  return [...neurons, ...tasks]
}
