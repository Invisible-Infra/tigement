import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const source = readFileSync(fileURLToPath(new URL('../src/utils/syncManager.ts', import.meta.url)), 'utf8')

function between(start, end) {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `Missing begin marker: ${start}`)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, `Missing end marker: ${end}`)
  return source.slice(from, to)
}

test('conflicting remote/local revisions are compared before any upload', () => {
  const conflict = between('if (remoteIsNewer && hasLocalChanges)', '} else if (remoteIsNewer) {')
  const fetch = conflict.indexOf('await api.getWorkspace()')
  const push = conflict.indexOf('await api.saveWorkspace(')
  assert.ok(fetch !== -1 && push > fetch)
  assert.doesNotMatch(conflict.slice(0, fetch), /api\.saveWorkspace\(/)
  assert.match(conflict, /this\.config\.onConflict\(conflictData\)/)
  assert.doesNotMatch(conflict, /if \(sameSource\)\s*\{[\s\S]*?saveWorkspace/)
})

test('409 never reuploads the same encrypted payload with a newly guessed version', () => {
  const handler = between('} catch (error: any) {\n      const isVersionConflict', '} finally {\n      if (!isRetrying)')
  assert.doesNotMatch(handler, /api\.saveWorkspace\(/)
  assert.doesNotMatch(handler, /versionConflictError\.currentVersion\s*\+\s*1/)
  assert.match(handler, /return this\.sync\(true, retryCount \+ 1\)/)
  assert.match(handler, /VERSION_CONFLICT_MAX_RETRIES/)
})

test('unavailable newer remote workspace fails closed rather than overwriting it', () => {
  const remote = between('if (!remoteWorkspace || !remoteWorkspace.data)', 'let remoteData')
  assert.match(remote, /throw new Error\(/)
  assert.doesNotMatch(remote, /saveWorkspace/)
})

test('another tab cannot advance this instance version without its workspace', () => {
  const handler = between('async sync(isRetry:', 'const localData = this.getLocalWorkspace()')
  assert.doesNotMatch(handler, /localStorage\.getItem\(this\.VERSION_STORAGE_KEY\)/)
  assert.match(handler, /this\.isSyncing = true/)
})

test('missing conflict handler does not silently discard pending local edits', () => {
  const conflict = between('if (remoteIsNewer && hasLocalChanges)', '} else if (remoteIsNewer) {')
  const noHandler = conflict.slice(conflict.lastIndexOf('} else {'))
  assert.match(noHandler, /throw new Error\('Workspace conflict/)
  assert.doesNotMatch(noHandler, /await this\.pull\(\)/)
})
