import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

import { Format, useLogg } from '@guiiai/logg'

import packageJSON from '../../package.json' with { type: 'json' }

async function listTables<TSchema extends Record<string, unknown>>(db: SqliteRemoteDatabase<TSchema>) {
  return db.all<{ table_name: string }>(`
    SELECT name AS table_name
    FROM sqlite_master
    WHERE type = 'table';
  `)
}

export async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>,
  bundledMigrations: {
    idx: number
    when: number
    tag: string
    hash: string
    sql: string[]
  }[],
) {
  const log = useLogg(packageJSON.name).withFormat(Format.Pretty)

  await db.run(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  const last = await db.get<{
    id: number
    hash: string
    created_at: number
  }>(`
    SELECT id, hash, created_at
    FROM __drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1;
  `)

  const pending = bundledMigrations.filter((m) => {
    const ts = last?.created_at ?? 0
    return !last || ts < m.when
  })

  if (pending.length === 0) {
    log.withField('tables', await listTables(db)).debug('no pending migrations')
    log.log('no pending migrations to apply')
    return
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < pending.length; i++) {
      const m = pending[i]

      log.log(`${i + 1}. Deploying migration:`)
      log.log(`     tag  => ${m.tag}`)
      log.log(`     hash => ${m.hash}`)

      for (const stmt of m.sql) {
        await tx.run(stmt)
      }

      await tx.run(`
        INSERT INTO __drizzle_migrations (hash, created_at, tag)
        VALUES ('${m.hash}', ${m.when}, '${m.tag}');
      `)
    }
  })

  log.withField('tables', await listTables(db)).debug('migration successful')
  log.log(`all ${pending.length} pending migrations applied!`)
}
