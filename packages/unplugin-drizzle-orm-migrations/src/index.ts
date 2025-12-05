import type { UnpluginInstance } from 'unplugin'

import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { cwd, env } from 'node:process'

import { loadConfig } from 'c12'
import { subtle } from 'uncrypto'
import { createUnplugin } from 'unplugin'

import { splitSQL } from './utils/split'

export function newPlugin(isRolldownLike = false) {
  const virtualName = 'virtual:drizzle-migrations.sql'
  const plainName = 'drizzle-migrations:sql'

  const virtualPrefix = 'virtual:drizzle-migrations/'
  const plainPrefix = 'drizzle-migrations/'

  // https://github.com/rolldown/rolldown/issues/1115
  const maybeApplyRolldownPrefix = (id: string) =>
    !isRolldownLike ? `\0${id}` : id

  const DrizzleORMMigrations: UnpluginInstance<{ configName?: string, root?: string, dbName?: string } | undefined, false>
    = createUnplugin((rawOptions = {}) => {
      const defaults = {
        root: cwd(),
        configName: 'drizzle',
        dbName: undefined,
      }

      const options = { ...defaults, ...rawOptions }

      const resolvedVirtualName = maybeApplyRolldownPrefix(virtualName)
      const resolvedPlainName = maybeApplyRolldownPrefix(plainName)
      const resolvedDbVirtualName = options.dbName
        ? maybeApplyRolldownPrefix(`${virtualPrefix}${options.dbName}.sql`)
        : null
      const resolvedDbPlainName = options.dbName
        ? maybeApplyRolldownPrefix(`${plainPrefix}${options.dbName}.sql`)
        : null

      let _drizzleConfig: {
        out?: string | null
        schema?: string | null
        dialect?: string | null
      }

      const migrateSQLFileContents: {
        idx: number
        when: number
        tag: string
        hash: string
        sql: string[]
      }[] = []

      return {
        name: 'drizzle-migrations',
        buildStart: async () => {
          const drizzleConfig = await loadConfig({
            name: options.configName,
            cwd: options.root,
          })

          _drizzleConfig = drizzleConfig.config
          if (!_drizzleConfig.out)
            return

          const outDir = isAbsolute(_drizzleConfig.out)
            ? _drizzleConfig.out
            : join(options.root, _drizzleConfig.out)

          const journalJSONContent = (await readFile(join(outDir, 'meta/_journal.json'))).toString('utf-8')
          const journal = JSON.parse(journalJSONContent) as {
            entries: {
              idx: number
              version: string
              when: number
              tag: string
              breakpoints: boolean
            }[]
          }

          for (let index = 0; index < journal.entries.length; index++) {
            const { when, idx, tag } = journal.entries[index]
            const migrateSQLFilePath = join(outDir, `${tag}.sql`)
            const migrateSQLFileContent = (await readFile(migrateSQLFilePath)).toString('utf-8')

            migrateSQLFileContents.push({
              idx,
              when,
              tag,
              hash: Buffer.from((await subtle.digest({ name: 'SHA-256' }, Buffer.from(migrateSQLFileContent, 'utf-8')))).toString('hex'),
              sql: splitSQL(migrateSQLFileContent),
            })
          }
        },
        resolveId(source) {
          if (options.dbName) {
            const fullName = `${virtualPrefix}${options.dbName}.sql`
            const fullPlain = `${plainPrefix}${options.dbName}.sql`
            if (source === fullName || source === fullPlain)
              return maybeApplyRolldownPrefix(source)
          }
          else
            if (source === virtualName || source === plainName) {
              return maybeApplyRolldownPrefix(source)
            }
        },
        load(id) {
          if (!_drizzleConfig.out)
            return null
          if (
            id === resolvedVirtualName
            || id === resolvedPlainName
            || id === resolvedDbVirtualName
            || id === resolvedDbPlainName
          ) {
            return `export default ${JSON.stringify(migrateSQLFileContents, null, env.NODE_ENV === 'production' ? 0 : 2)}`
          }
          return null
        },
      }
    })

  return DrizzleORMMigrations
}
