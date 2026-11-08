// @ts-expect-error no types
import { string } from 'rollup-plugin-string'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [string({ include: '**/*.ejs' })],
  test: {
    include: ['test/**/*.test.ts'],
    maxWorkers: 1,
    minWorkers: 1,
  },
})
