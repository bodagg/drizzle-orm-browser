import type { PgliteDatabase } from 'drizzle-orm/pglite'

import { sql } from 'drizzle-orm'

import type { ExtractTx, Logger, Migration, MigrationDialect } from '../shared'

import { createExecute, createExecuteWithSql, createQueryHelpers, createRunHelpers, listTables as listTablesShared, migrate as migrateShared } from '../shared'

async function listTables<TSchema extends Record<string, unknown>>(db: PgliteDatabase<TSchema>) {
  return listTablesShared(
    () => db.execute<{ table_name: string }>(sql`
      SELECT
        table_name
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `),
    r => r.rows,
  )
}

export async function migrate<TSchema extends Record<string, unknown>>(db: PgliteDatabase<TSchema>, bundledMigrations: Migration[], logger?: Logger) {
  type Tx = ExtractTx<PgliteDatabase<TSchema>>

  const execute = createExecuteWithSql<PgliteDatabase<TSchema>>(sql)

  const queryHelpers = createQueryHelpers<PgliteDatabase<TSchema>>(execute)
  const runHelpers = createRunHelpers<PgliteDatabase<TSchema>>(execute)

  const dialect: MigrationDialect<PgliteDatabase<TSchema>, Tx> = {
    ...queryHelpers,
    ...runHelpers,
    listTables,
    execute: createExecute<Tx>(),
    getTableDefinition: (tableName) => {
      return `CREATE TABLE IF NOT EXISTS ${tableName} (
        id bigserial PRIMARY KEY NOT NULL,
        hash text NOT NULL,
        created_at bigint NOT NULL
      );`
    },
    tableName: '__drizzle_migrations',
  }

  await migrateShared(db, dialect, bundledMigrations, logger)
}
