import type { Logger } from './logger'
import type { QueryHelpers, RunHelpers } from './queries'

import { createDefaultLog, normalizeLogger } from './logger'
import { createInsertMigration, ensureTable, getAppliedHashes } from './table'
import { createRunStatement, createTransaction } from './transaction'

export interface Migration {
  idx: number
  when: number
  tag: string
  hash: string
  sql: string[]
}

export interface MigrationDialect<DB, TX> extends QueryHelpers<DB>, RunHelpers<DB> {
  listTables: (db: DB) => Promise<{ table_name: string }[]>
  execute: (tx: TX, sql: string | unknown) => Promise<void>
  getTableDefinition: (tableName: string) => string
  tableName: string
  transaction?: (db: DB, fn: (tx: TX) => Promise<void>) => Promise<void>
}

export type ExtractTx<DB> = Parameters<Parameters<DB extends { transaction: (fn: (tx: any) => Promise<void>) => Promise<void> } ? DB['transaction'] : never>[0]>[0]

export async function migrate<DB, TX>(
  db: DB,
  dialect: MigrationDialect<DB, TX>,
  bundledMigrations: Migration[],
  logger?: Logger,
) {
  const log = normalizeLogger(logger ?? createDefaultLog())
  // 1. ensure migrations table
  await ensureTable(db, dialect)

  // 2. get all applied migration hashes from database
  const appliedHashes = await getAppliedHashes(db, dialect.runQuery, dialect.pickQueryResult, dialect.tableName, log)

  // 3. filter out migrations that have already been applied (by hash)
  const pending = bundledMigrations.filter(m => !appliedHashes.has(m.hash))

  if (appliedHashes.size > 0) {
    const hashList = Array.from(appliedHashes).join(', ')
    log.debug(`${appliedHashes.size} migration(s) already applied (hashes: ${hashList})`)
  }

  if (pending.length > 0) {
    log.debug(`${pending.length} migration(s) pending: ${pending.map(m => m.tag).join(', ')}`)
  }
  else {
    log.debug('all migrations already applied')
  }

  if (pending.length === 0) {
    log.debug('all migrations already applied')
    return
  }

  // 4. apply migrations
  const transaction = dialect.transaction ?? createTransaction(db as DB & { transaction: (fn: (tx: TX) => Promise<void>) => Promise<void> })
  const runStatement = createRunStatement(dialect)
  const insertMigration = createInsertMigration(dialect)

  await transaction(db, async (tx) => {
    for (let i = 0; i < pending.length; i++) {
      const m = pending[i]

      log.debug(`${i + 1}. Deploying migration:`)
      log.debug(`     tag  => ${m.tag}`)
      log.debug(`     hash => ${m.hash}`)

      for (const stmt of m.sql) {
        try {
          await runStatement(tx, stmt)
        }
        catch (err) {
          log.debug(`failed sql: ${stmt.substring(0, 200)}...`)
          const errorMessage = err instanceof Error ? err.message : String(err)
          log.debug(`error: ${errorMessage}`)
          throw err
        }
      }

      // Only insert migration record if we successfully applied all statements
      await insertMigration(tx, m)
      log.debug(`✓ migration ${m.tag} recorded`)
    }
  })

  log.withField('tables', await dialect.listTables(db)).debug('migration successful')
  log.debug(`all ${pending.length} pending migrations applied!`)
}
