import { defineBuildConfig } from 'unbuild'
// @ts-expect-error no types
import { string } from 'rollup-plugin-string'

export default defineBuildConfig({
  entries: ['src/index'],
  clean: false,
  declaration: true,
  externals: ['vite', 'fs'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
    dts: {
      respectExternal: true,
    },
  },
  hooks: {
    'rollup:options': function (_ctx, options) {
      if (Array.isArray(options.plugins)) {
        options.plugins.push(
          string({
            include: '**/*.ejs',
          }),
        )
      }
    },
  },
})
