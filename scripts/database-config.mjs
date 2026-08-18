import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))

export const projectDirectory = resolve(scriptsDirectory, '..')
export const databaseDirectory = resolve(projectDirectory, 'database')
export const databaseFile = resolve(databaseDirectory, 'postflow.db')
export const schemaFile = resolve(databaseDirectory, 'schema.sql')
export const seedFile = resolve(databaseDirectory, 'seed.sql')

export function readSqlFile(filePath) {
  return readFileSync(filePath, 'utf8')
}
