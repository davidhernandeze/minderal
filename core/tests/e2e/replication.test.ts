import { describe, inject } from 'vitest'
import { createTracked } from '../support/datasets.js'
import { describeReplicationTarget } from '../support/replicationSuite.js'

describe.runIf(inject('runtime') === 'nodejs')('a served ServerCore', () => {
  describeReplicationTarget('a ServerCore', async () => {
    const core = await createTracked()
    return { url: await core.serve() }
  })
})
