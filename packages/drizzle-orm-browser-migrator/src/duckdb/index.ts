import type { DuckDBWasmDatabase } from '@proj-airi/drizzle-duckdb-wasm'

import { sql } from 'drizzle-orm'

import type { ExtractTx, Logger, Migration, MigrationDialect } from '../shared'

import { createExecute, createExecuteWithSql, createQueryHelpers, createRunHelpers, listTables as listTablesShared, migrate as migrateShared } from '../shared'

async function listTables<TSchema extends Record<string, unknown>>(db: DuckDBWasmDatabase<TSchema>) {
  return listTablesShared(
    () => db.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main';
    `),
    r => r,
  )
}

export async function migrate<TSchema extends Record<string, unknown>>(
  db: DuckDBWasmDatabase<TSchema>,
  bundledMigrations: Migration[],
  logger?: Logger,
) {
  type Tx = ExtractTx<DuckDBWasmDatabase<TSchema>>

  const execute = createExecuteWithSql<DuckDBWasmDatabase<TSchema>>(sql)

  const queryHelpers = createQueryHelpers<DuckDBWasmDatabase<TSchema>>(execute)
  const runHelpers = createRunHelpers<DuckDBWasmDatabase<TSchema>>(execute)

  const dialect: MigrationDialect<DuckDBWasmDatabase<TSchema>, Tx> = {
    ...queryHelpers,
    ...runHelpers,
    listTables,
    execute: createExecute<Tx>(),
    getTableDefinition: (tableName) => {
      return `
CREATE SEQUENCE IF NOT EXISTS ${tableName}_id_seq;

CREATE TABLE IF NOT EXISTS ${tableName} (
  id BIGINT PRIMARY KEY DEFAULT nextval('${tableName}_id_seq'),
  hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
`
    },
    tableName: '__drizzle_migrations',
  }

  await migrateShared(db, dialect, bundledMigrations, logger)
}
