import type { MigrationDialect } from './migrate'

export function createTransaction<DB extends { transaction: (fn: (tx: any) => Promise<void>) => Promise<void> }, TX>(
  _db: DB,
): (db: DB, fn: (tx: TX) => Promise<void>) => Promise<void> {
  return async (db, fn) => {
    await db.transaction(fn)
  }
}

export function createRunStatement<TX>(dialect: MigrationDialect<unknown, TX>): (tx: TX, stmt: string) => Promise<void> {
  return async (tx, stmt) => {
    await dialect.execute(tx, stmt)
  }
}
