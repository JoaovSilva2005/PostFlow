import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const inventory = JSON.parse(
  await readFile(resolve(root, 'scripts/database/migration-inventory.json'), 'utf8'),
)
const migrationDirectories = Object.keys(inventory)

for (const directory of migrationDirectories) {
  const expected = inventory[directory].slice().sort()
  const actual = (await readdir(resolve(root, directory)))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  assert.deepEqual(
    actual,
    expected,
    `${directory} difere do inventário. Atualize o manifesto sem mover migrações históricas.`,
  )
  for (const name of expected) {
    assert.match(
      name,
      /^\d{8}(?:\d{6})?_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/i,
      `Nome de migração inválido: ${directory}/${name}`,
    )
  }
}

const documentationFiles = [
  'README.md',
  'backend/README.md',
  'database/README.md',
  'docs/architecture.md',
  'docs/production-readiness-audit.md',
]
for (const path of documentationFiles) {
  const content = await readFile(resolve(root, path), 'utf8')
  for (const match of content.matchAll(/(?:database|supabase)\/migrations\/[\w.-]+\.sql/g)) {
    const referencedPath = match[0]
    assert.equal(
      migrationDirectories.some((directory) =>
        inventory[directory].includes(referencedPath.slice(directory.length + 1)),
      ),
      true,
      `${path} referencia migração ausente: ${referencedPath}`,
    )
  }

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)#]+\.sql)\)/g)) {
    const href = match[1]
    if (/^https?:\/\//i.test(href)) continue
    const resolvedFromDocument = resolve(dirname(resolve(root, path)), href)
    const resolvedFromRoot = resolve(root, href)
    const exists = await Promise.any([
      readFile(resolvedFromDocument).then(() => true),
      readFile(resolvedFromRoot).then(() => true),
    ]).catch(() => false)
    assert.equal(exists, true, `${path} contém link SQL quebrado: ${href}`)
  }
}

assert.match(
  await readFile(resolve(root, 'README.md'), 'utf8'),
  /database\/migrations[\s\S]*supabase\/migrations/,
  'O README deve explicar as duas linhagens de migrações.',
)

console.log(
  `Inventário de migrações válido: ${Object.values(inventory).reduce((sum, files) => sum + files.length, 0)} arquivos.`,
)
