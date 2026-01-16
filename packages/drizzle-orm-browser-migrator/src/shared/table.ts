import type { Migration, MigrationDialect } from './migrate'

export async function listTables<T>(
  run: () => Promise<T>,
  pick: (r: T) => { table_name: string }[],
) {
  return pick(await run())
}

export async function ensureTable<DB>(
  db: DB,
  dialect: MigrationDialect<DB, unknown>,
): Promise<void> {
  const tableDefinition = dialect.getTableDefinition(dialect.tableName)
  await dialect.run(db, tableDefinition)
}

function pickAppliedMigrations(result: unknown): { hash: string }[] {
  // Handle PGLite format: { rows: [...] }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows: Array<{ hash: string } | unknown[]> }).rows
    return rows.map((row) => {
      // Handle array-based rows (SQLocal): [id, hash, created_at]
      if (Array.isArray(row)) {
        return { hash: String(row[1] || '') }
      }
      // Handle object-based rows: { hash: string }
      return { hash: (row as { hash: string }).hash }
    })
  }

  // Handle array format: [...] (SQLite, PostgreSQL, DuckDB)
  if (Array.isArray(result)) {
    return result.map((row) => {
      // Handle array-based rows (SQLocal): [id, hash, created_at]
      if (Array.isArray(row)) {
        return { hash: String(row[1] || '') }
      }
      // Handle object-based rows: { hash: string }
      return { hash: (row as { hash: string }).hash }
    })
  }

  return []
}

export async function getAppliedHashes<DB, T>(
  db: DB,
  runQuery: (db: DB, sql: string) => Promise<T>,
  pickResult: (r: T) => unknown,
  tableName: string,
  log?: { debug: (message: string) => void },
): Promise<Set<string>> {
  try {
    // Query all columns to match Drizzle's standard migration table structure:
    // id (PRIMARY KEY), hash (TEXT), created_at (BIGINT/INTEGER)
    const rawResult = await runQuery(db, `SELECT id, hash, created_at FROM ${tableName};`)
    const result = pickResult(rawResult)
    const appliedMigrations = pickAppliedMigrations(result)
    const hashes = appliedMigrations.map(m => m.hash).filter((h): h is string => Boolean(h))

    if (log && hashes.length === 0 && appliedMigrations.length > 0) {
      log.debug(`warning: found ${appliedMigrations.length} migration record(s) but extracted 0 hashes`)
      log.debug(`raw result type: ${typeof result}, isArray: ${Array.isArray(result)}`)
      if (Array.isArray(result) && result.length > 0) {
        log.debug(`first item keys: ${Object.keys(result[0] || {}).join(', ')}`)
        log.debug(`first item: ${JSON.stringify(result[0])}`)
      }
    }

    return new Set(hashes)
  }
  catch (err) {
    // Table might not exist yet or be empty - return empty set
    // This is safe because it just means no migrations have been applied yet
    if (log) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      log.debug(`could not retrieve applied migrations: ${errorMsg}`)
    }
    return new Set<string>()
  }
}

export function createInsertMigration<TX>(dialect: MigrationDialect<unknown, TX>): (tx: TX, m: Migration) => Promise<void> {
  return async (tx, m) => {
    await dialect.execute(tx, `INSERT INTO ${dialect.tableName} (hash, created_at) VALUES ('${m.hash}', ${m.when});`)
  }
}
