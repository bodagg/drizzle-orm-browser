export function createRunQuery<DB>(
  execute: (db: DB, sql: string) => Promise<unknown>,
): (db: DB, sql: string) => Promise<unknown> {
  return async (db, sql) => {
    return await execute(db, sql)
  }
}

export function createPickQueryResult(
  pick: (result: unknown) => unknown = r => r,
): (result: unknown) => unknown {
  return pick
}

export interface QueryHelpers<DB> {
  runQuery: (db: DB, sql: string) => Promise<unknown>
  pickQueryResult: (result: unknown) => unknown
}

export interface RunHelpers<DB> {
  run: (db: DB, sql: string | unknown) => Promise<void>
}

export function createQueryHelpers<DB>(
  execute: (db: DB, sql: string | unknown) => Promise<unknown>,
  pick: (result: unknown) => unknown = r => r,
): QueryHelpers<DB> {
  return {
    runQuery: async (db, sql) => await execute(db, sql),
    pickQueryResult: pick,
  }
}

export function createRunHelpers<DB>(
  execute: (db: DB, sql: string | unknown) => Promise<unknown>,
): RunHelpers<DB> {
  return {
    run: async (db, sql) => {
      await execute(db, sql)
    },
  }
}

export function createExecute<TX extends { execute: (sql: string) => Promise<unknown> }>(): (tx: TX, sql: string | unknown) => Promise<void> {
  return async (tx, sqlStmt) => {
    await tx.execute(sqlStmt as string)
  }
}

export function createExecuteWithSql<DB extends { execute: (sql: any) => Promise<unknown> }>(
  sqlTag: typeof import('drizzle-orm').sql,
): (db: DB, sqlStmt: string | unknown) => Promise<unknown> {
  return async (db, sqlStmt) => {
    return await db.execute(sqlTag`${sqlTag.raw(sqlStmt as string)}`)
  }
}
