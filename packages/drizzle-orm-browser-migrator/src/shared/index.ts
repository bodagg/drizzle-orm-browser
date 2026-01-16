// Re-export everything from the split modules for backward compatibility
export type { Logger } from './logger'
export { createDefaultLog, normalizeLogger } from './logger'

export type { ExtractTx, Migration, MigrationDialect } from './migrate'
export { migrate } from './migrate'

export type { QueryHelpers, RunHelpers } from './queries'
export {
  createExecute,
  createExecuteWithSql,
  createPickQueryResult,
  createQueryHelpers,
  createRunHelpers,
  createRunQuery,
} from './queries'

export { createInsertMigration, ensureTable, getAppliedHashes, listTables } from './table'

export { createRunStatement, createTransaction } from './transaction'
