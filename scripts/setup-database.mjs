import { mkdirSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import {
  databaseDirectory,
  databaseFile,
  readSqlFile,
  schemaFile,
  seedFile,
} from './database-config.mjs'

function resetDatabaseFile() {
  mkdirSync(databaseDirectory, { recursive: true })
  rmSync(databaseFile, { force: true })
}

function createDatabase() {
  const database = new DatabaseSync(databaseFile)

  try {
    database.exec('PRAGMA foreign_keys = ON;')
    database.exec(readSqlFile(schemaFile))
    database.exec(readSqlFile(seedFile))

    const integrityResult = database.prepare('PRAGMA integrity_check;').get()

    if (integrityResult?.integrity_check !== 'ok') {
      throw new Error('A verificação de integridade do banco falhou.')
    }
  } finally {
    database.close()
  }
}

resetDatabaseFile()
createDatabase()

console.log('Banco PostFlow criado e populado com sucesso.')
console.log(`Arquivo: ${databaseFile}`)
console.log('Execute npm run db:verify para conferir as tabelas e os dados.')
