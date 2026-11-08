import type { Plugin, ResolvedConfig } from 'vite'
import type { NormalizedFile, Options } from './types.ts'
import { resolve } from 'node:path'
import { resolveFiles, writeFiles } from './files.ts'
import { configureServer } from './server.ts'

export default function pluginGenerateFile(options?: Options): Plugin {
  let config: ResolvedConfig
  let files = new Map<string, NormalizedFile>()

  return {
    name: 'vite-plugin-generate-file',
    configResolved(resolvedConfig) {
      config = resolvedConfig
      files = resolveFiles(options, resolve(config.root, config.build.outDir))
    },
    writeBundle() {
      writeFiles(files, config.root)
    },
    configureServer: server => configureServer(server, files),
  }
}
