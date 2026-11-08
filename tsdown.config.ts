import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: {
    esm: {},
    cjs: {
      dts: false,
      copy: ['src/index.d.cts'],
    },
  },
  dts: true,
  clean: true,
  target: 'node22',
  platform: 'node',
  deps: {
    neverBundle: ['vite'],
  },
})
