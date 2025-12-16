import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'pglite/index': './src/pglite/index.ts',
    'pg/index': './src/pg/index.ts',
    'sqlocal/index': './src/sqlocal/index.ts',
  },
  unused: true,
  fixedExtension: true,
})
