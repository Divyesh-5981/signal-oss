import { setFailed } from '@actions/core'
import { run } from './main.js'

run().catch((err) => {
  setFailed(err instanceof Error ? err.message : String(err))
})
