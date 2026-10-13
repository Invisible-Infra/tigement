import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  composeDeadline,
  deadlineBackgroundHex,
  deadlineRowClass,
  deadlineStatus,
  normalizeDeadline,
} from './deadline.ts'

const noon = new Date(2026, 9, 13, 12, 0, 0, 0)

test('no deadline stays none', () => {
  assert.equal(deadlineStatus(undefined, noon), 'none')
  assert.equal(deadlineStatus(null, noon), 'none')
  assert.equal(deadlineStatus('', noon), 'none')
})

test('date-only yesterday is overdue and today is soon', () => {
  assert.equal(deadlineStatus('2026-10-12', noon), 'overdue')
  assert.equal(deadlineStatus('2026-10-13', noon), 'soon')
  assert.equal(deadlineStatus('2026-10-15', noon), 'none')
})

test('date-only becomes overdue at the next local midnight', () => {
  const midnight = new Date(2026, 9, 14, 0, 0, 0, 0)
  assert.equal(deadlineStatus('2026-10-13', new Date(midnight.getTime() - 1)), 'soon')
  assert.equal(deadlineStatus('2026-10-13', midnight), 'overdue')
})

test('date and time use the exact local instant', () => {
  assert.equal(deadlineStatus('2026-10-15T12:00', noon), 'none')
  assert.equal(deadlineStatus('2026-10-14T11:00', noon), 'soon')
  assert.equal(deadlineStatus('2026-10-13T12:00', noon), 'overdue')
  assert.equal(deadlineStatus('2026-10-13T11:00', noon), 'overdue')
})

test('midnight date-time is not a date-only deadline', () => {
  assert.equal(deadlineStatus('2026-10-13T00:00', noon), 'overdue')
  assert.equal(deadlineStatus('2026-10-13', noon), 'soon')
  assert.equal(normalizeDeadline('2026-10-13T00:00'), '2026-10-13T00:00')
  assert.equal(normalizeDeadline('2026-10-13'), '2026-10-13')
})

test('time without a date is rejected', () => {
  assert.equal(normalizeDeadline('15:00'), null)
  assert.equal(composeDeadline('', '15:00'), null)
  assert.equal(deadlineStatus('15:00', noon), 'none')
  assert.equal(normalizeDeadline('2026-10-13T15:00Z'), null)
  assert.equal(normalizeDeadline('2026-02-31'), null)
})

test('row classes follow deadline status', () => {
  assert.equal(deadlineRowClass('overdue'), 'bg-red-200 text-red-900')
  assert.equal(deadlineRowClass('soon'), 'bg-yellow-200 text-yellow-900')
  assert.equal(deadlineRowClass('none'), '')
  assert.equal(deadlineBackgroundHex('overdue'), '#fecaca')
  assert.equal(deadlineBackgroundHex('soon'), '#fef08c')
  assert.equal(deadlineBackgroundHex('none'), null)
})
