import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

import type { ExtractTx, Logger, Migration, MigrationDialect } from '../shared'

import { createQueryHelpers, createRunHelpers, listTables as listTablesShared, migrate as migrateShared } from '../shared'

async function listTables<TSchema extends Record<string, unknown>>(db: SqliteRemoteDatabase<TSchema>) {
  return listTablesShared(
    () => db.all<{ table_name: string }>(`
      SELECT name AS table_name
      FROM sqlite_master
      WHERE type = 'table';
    `),
    r => r,
  )
}

export async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>,
  bundledMigrations: Migration[],
  logger?: Logger,
) {
  type Tx = ExtractTx<SqliteRemoteDatabase<TSchema>>

  const queryHelpers = createQueryHelpers<SqliteRemoteDatabase<TSchema>>(
    async (db, sql) => await (db as SqliteRemoteDatabase<TSchema>).all(sql as string),
  )
  const runHelpers = createRunHelpers<SqliteRemoteDatabase<TSchema>>(
    async (db, sql) => {
      await (db as SqliteRemoteDatabase<TSchema>).run(sql as string)
    },
  )

  const dialect: MigrationDialect<SqliteRemoteDatabase<TSchema>, Tx> = {
    ...queryHelpers,
    ...runHelpers,
    listTables,
    execute: async (tx, sql) => {
      await tx.run(sql as string)
    },
    getTableDefinition: (tableName) => {
      return `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );`
    },
    tableName: '__drizzle_migrations',
  }

  await migrateShared(db, dialect, bundledMigrations, logger)
}
