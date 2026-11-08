import type { Plugin, PreviewServer } from 'vite'
import type { Options } from '../src/index.ts'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { build, preview } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupProjects, createProject } from '../test/helpers.ts'

type PluginFactory = (options?: Options) => Plugin

const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)
const servers: PreviewServer[] = []

async function loadPlugin(format: 'ESM' | 'CommonJS'): Promise<PluginFactory> {
  const packageName = 'vite-plugin-generate-file'
  const factory = format === 'ESM'
    ? (await import(packageName)).default
    : require(packageName)
  expect(typeof factory).toBe('function')
  return factory
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.httpServer.close(error => error
      ? reject(error)
      : resolve())
  })))
  await cleanupProjects()
})

describe('built package', () => {
  it('typechecks ESM and directly callable CommonJS consumers', async () => {
    const root = await createProject()
    await writeFile(resolve(root, 'consumer.mts'), `
import generateFile from 'vite-plugin-generate-file'
import type { GenerateFile, Options } from 'vite-plugin-generate-file'
const file: GenerateFile = { data: { value: 'ESM' } }
const options: Options = [file]
generateFile(options)
// @ts-expect-error unsupported output format
generateFile({ type: 'invalid' })
`)
    await writeFile(resolve(root, 'consumer.cts'), `
import generateFile = require('vite-plugin-generate-file')
import type { GenerateFile, Options } from 'vite-plugin-generate-file'
const file: GenerateFile = { data: { value: 'CommonJS' } }
const options: Options = [file]
generateFile(options)
// @ts-expect-error unsupported output format
generateFile({ type: 'invalid' })
`)
    await writeFile(resolve(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ESNext',
      },
      files: ['consumer.mts', 'consumer.cts'],
    }))
    await execFileAsync(process.execPath, [
      require.resolve('typescript/bin/tsc'),
      '--project',
      resolve(root, 'tsconfig.json'),
    ])
  })

  it.each(['ESM', 'CommonJS'] as const)('builds generated files through the %s entry', async (format) => {
    const generateFile = await loadPlugin(format)
    const root = await createProject()
    await writeFile(resolve(root, 'template.ejs'), 'Hello <%= name %>')
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [
        generateFile([
          {
            output: 'data.json',
            data: { format },
          },
          {
            output: 'template.txt',
            type: 'template',
            template: 'template.ejs',
            data: { name: format },
          },
          {
            output: 'raw.bin',
            type: 'raw',
            data: Buffer.from([0, 255, 1]),
          },
        ]),
      ],
    })
    expect(JSON.parse(await readFile(resolve(root, 'dist/data.json'), 'utf8'))).toEqual({ format })
    expect(await readFile(resolve(root, 'dist/template.txt'), 'utf8')).toBe(`Hello ${format}`)
    expect(await readFile(resolve(root, 'dist/raw.bin'))).toEqual(Buffer.from([0, 255, 1]))
  })

  it('serves built files and the application through production preview', async () => {
    const generateFile = await loadPlugin('ESM')
    const root = await createProject()
    const config = {
      root,
      configFile: false as const,
      logLevel: 'silent' as const,
      base: '/generated/',
      plugins: [
        generateFile({
          output: 'nested/data.json',
          data: { preview: true },
        }),
      ],
      preview: { host: '127.0.0.1', port: 0 },
    }
    await build(config)
    const server = await preview(config)
    servers.push(server)
    const url = server.resolvedUrls!.local[0]
    const response = await fetch(new URL('nested/data.json', url))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ preview: true })
    expect(await (await fetch(url)).text()).toContain('Test application')
    expect((await readdir(resolve(root, 'dist'))).sort()).toEqual(['index.html', 'nested'])
  })
})
