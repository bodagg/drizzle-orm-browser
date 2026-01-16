import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { sql } from 'drizzle-orm'

import type { ExtractTx, Logger, Migration, MigrationDialect } from '../shared'

import { createExecute, createExecuteWithSql, createQueryHelpers, createRunHelpers, listTables as listTablesShared, migrate as migrateShared } from '../shared'

async function listTables<TSchema extends Record<string, unknown>>(db: PostgresJsDatabase<TSchema>) {
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

export async function migrate<TSchema extends Record<string, unknown>>(db: PostgresJsDatabase<TSchema>, bundledMigrations: Migration[], logger?: Logger) {
  // PostgreSQL requires an explicit schema to namespace migration tables
  type Tx = ExtractTx<PostgresJsDatabase<TSchema>>

  const execute = createExecuteWithSql<PostgresJsDatabase<TSchema>>(sql)

  const queryHelpers = createQueryHelpers<PostgresJsDatabase<TSchema>>(execute)
  const runHelpers = createRunHelpers<PostgresJsDatabase<TSchema>>(execute)

  const dialect: MigrationDialect<PostgresJsDatabase<TSchema>, Tx> = {
    ...queryHelpers,
    ...runHelpers,
    listTables,
    execute: createExecute<Tx>(),
    getTableDefinition: (tableName) => {
      return `CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS ${tableName} (
  id bigserial PRIMARY KEY NOT NULL,
  hash text NOT NULL,
  created_at bigint NOT NULL
);`
    },
    tableName: 'drizzle.__drizzle_migrations',
  }

  await migrateShared(db, dialect, bundledMigrations, logger)
}
