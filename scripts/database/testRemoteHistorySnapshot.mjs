// Static evidence check only: never connects, repairs history, or applies SQL.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const snapshot = JSON.parse(
  await readFile(
    resolve(root, 'scripts/database/remote-history-2026-10-29.json'),
    'utf8',
  ),
)
const inventory = JSON.parse(
  await readFile(
    resolve(root, 'scripts/database/migration-inventory.json'),
    'utf8',
  ),
)
const expected = Object.entries(inventory)
  .flatMap(([directory, files]) => files.map((file) => `${directory}/${file}`))
  .sort()
const covered = [
  ...snapshot.records.map((r) => r.localPath),
  ...snapshot.localWithoutSeparateRemoteEntry.map((r) => r.localPath),
].sort()
assert.deepEqual(
  covered,
  expected,
  'Snapshot must explicitly account for every local migration.',
)
assert.equal(
  new Set(snapshot.records.map((r) => r.remoteVersion)).size,
  snapshot.records.length,
)
for (const record of snapshot.records) {
  const sql = (await readFile(resolve(root, record.localPath), 'utf8'))
    .replace(/\r\n/g, '\n')
    .trim()
  assert.equal(
    createHash('sha256').update(sql).digest('hex'),
    record.localSha256,
    `${record.localPath}: historical SQL changed since the read-only comparison; investigate rather than reapplying.`,
  )
  assert.match(record.remoteSha256, /^[a-f0-9]{64}$/)
  if (record.comparison === 'exact_after_line_endings')
    assert.equal(record.remoteSha256, record.localSha256)
  else
    assert.equal(
      record.comparison,
      'reviewed_comments_whitespace_transaction_wrapper_only',
    )
}
console.log(
  `Remote history evidence valid: ${snapshot.records.length} reviewed mappings; snapshot ${snapshot.observedAt}. No live database assertion.`,
)
