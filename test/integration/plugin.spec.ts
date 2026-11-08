import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { Options } from '../../src/index.ts'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import generateFile from '../../src/index.ts'
import { cleanupProjects, createProject } from '../helpers.ts'

const servers: ViteDevServer[] = []
const emptyConfigurations = [
  {
    name: 'omitted options',
    createPlugin: () => generateFile(),
  },
  {
    name: 'undefined',
    createPlugin: () => generateFile(undefined),
  },
  {
    name: 'an empty array',
    createPlugin: () => generateFile([]),
  },
]

async function runBuild(root: string, plugin: Plugin, config: InlineConfig = {}) {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    ...config,
    plugins: [plugin],
  })
}

async function startServer(root: string, plugin: Plugin, config: InlineConfig = {}) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0 },
    ...config,
  })
  servers.push(server)
  await server.listen()
  return server.resolvedUrls!.local[0]
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await cleanupProjects()
})

describe('generated files', () => {
  it('returns an error response when a development template cannot be read', async () => {
    const root = await createProject()
    const url = await startServer(root, generateFile({
      output: 'missing.txt',
      type: 'template',
      template: 'missing.ejs',
    }))
    const response = await fetch(new URL('missing.txt', url))
    expect(response.status).toBe(500)
  })

  it('does not generate files when the application build fails', async () => {
    const root = await createProject()
    await writeFile(resolve(root, 'index.html'), '<script type="module" src="/missing.ts"></script>')
    await expect(runBuild(root, generateFile({ output: 'generated.txt', type: 'raw', data: 'not built' }))).rejects.toThrow()
    expect(existsSync(resolve(root, 'dist/generated.txt'))).toBe(false)
  })

  it('does not write generated files for an in-memory build', async () => {
    const root = await createProject()
    await runBuild(root, generateFile({ output: 'generated.txt', type: 'raw', data: 'in memory' }), {
      build: { write: false },
    })
    expect(existsSync(resolve(root, 'dist'))).toBe(false)
  })

  it.each(emptyConfigurations)('does not generate files for $name', async ({ createPlugin }) => {
    const root = await createProject()
    await runBuild(root, createPlugin())
    expect(await readdir(resolve(root, 'dist'))).toEqual(['index.html'])
  })

  it('preserves the default output for an explicit configuration object', async () => {
    const root = await createProject()
    await runBuild(root, generateFile({}))
    expect(await readFile(resolve(root, 'dist/output.txt'), 'utf8')).toBe('')
  })

  it('writes nested outputs under the configured build directory', async () => {
    const root = await createProject()
    await runBuild(root, generateFile({
      output: 'nested/data.json',
      data: { custom: true },
    }), {
      build: { outDir: 'output/client' },
    })
    expect(JSON.parse(await readFile(resolve(root, 'output/client/nested/data.json'), 'utf8'))).toEqual({ custom: true })
    expect(existsSync(resolve(root, 'dist'))).toBe(false)
  })

  it('preserves standard EJS escaping, raw output and control flow', async () => {
    const root = await createProject()
    await writeFile(resolve(root, 'template.ejs'), '<% for (const item of items) { %><%= item %>|<%- item %>;<% } %>')
    await runBuild(root, generateFile({
      output: 'template.txt',
      type: 'template',
      template: 'template.ejs',
      data: {
        items: ['<strong>Hello</strong>'],
      },
    }))
    expect(await readFile(resolve(root, 'dist/template.txt'), 'utf8')).toBe('&lt;strong&gt;Hello&lt;/strong&gt;|<strong>Hello</strong>;')
  })

  it('serves generated files and lists with a base prefix without intercepting the app', async () => {
    const root = await createProject()
    const url = await startServer(root, generateFile({
      output: 'nested/data.json',
      data: { preview: true },
    }), {
      base: '/files/',
    })
    for (const pathname of ['/nested/data.json', '/files/nested/data.json?download=1']) {
      const response = await fetch(new URL(pathname, url))
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(await response.json()).toEqual({ preview: true })
    }
    for (const pathname of ['/__generate_file_list/', '/files/__generate_file_list/']) {
      const response = await fetch(new URL(pathname, url))
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('nested/data.json')
    }
    expect(await (await fetch(new URL('/files/', url))).text()).toContain('Test application')
    expect(existsSync(resolve(root, 'dist'))).toBe(false)
  })

  it('generates supported formats and keeps the last duplicate output', async () => {
    const root = await createProject()
    await writeFile(resolve(root, 'template.ejs'), 'Hello <%= name %>!')
    await runBuild(root, generateFile([
      {
        output: 'data.json',
        data: { value: 'old' },
      },
      {
        output: './data.json',
        data: { value: 'new' },
      },
      {
        output: 'data.yaml',
        type: 'yaml',
        data: { value: 'yaml' },
      },
      {
        output: 'nested/template.txt',
        type: 'template',
        template: 'template.ejs',
        data: { name: 'Vite' },
      },
      { output: 'raw.txt', type: 'raw', data: 'raw text' },
      {
        output: 'raw.bin',
        type: 'raw',
        data: Buffer.from([0, 255, 1]),
      },
    ]))
    expect(JSON.parse(await readFile(resolve(root, 'dist/data.json'), 'utf8'))).toEqual({ value: 'new' })
    expect(await readFile(resolve(root, 'dist/data.yaml'), 'utf8')).toBe('value: yaml\n')
    expect(await readFile(resolve(root, 'dist/nested/template.txt'), 'utf8')).toBe('Hello Vite!')
    expect(await readFile(resolve(root, 'dist/raw.txt'), 'utf8')).toBe('raw text')
    expect(await readFile(resolve(root, 'dist/raw.bin'))).toEqual(Buffer.from([0, 255, 1]))
  })

  it('does not carry files into a later build', async () => {
    const root = await createProject()
    await runBuild(root, generateFile({
      output: 'first.json',
      data: { first: true },
    }))
    await runBuild(root, generateFile({
      output: 'second.json',
      data: { second: true },
    }))
    expect((await readdir(resolve(root, 'dist'))).sort()).toEqual(['index.html', 'second.json'])
  })

  it.each(emptyConfigurations)('does not carry files into a later build with $name', async ({ createPlugin }) => {
    const root = await createProject()
    await runBuild(root, generateFile({
      output: 'first.json',
      data: { first: true },
    }))
    await runBuild(root, createPlugin())
    expect(await readdir(resolve(root, 'dist'))).toEqual(['index.html'])
  })

  it('rebuilds its file list when reusing a plugin instance', async () => {
    const root = await createProject()
    const options: Options = [
      {
        output: 'first.json',
        data: { first: true },
      },
    ]
    const plugin = generateFile(options)
    await runBuild(root, plugin)
    options.splice(0, 1, {
      output: 'second.json',
      data: { second: true },
    })
    await runBuild(root, plugin)
    expect((await readdir(resolve(root, 'dist'))).sort()).toEqual(['index.html', 'second.json'])
  })

  it('isolates roots and templates between concurrent builds', async () => {
    const firstRoot = await createProject()
    const secondRoot = await createProject()
    await writeFile(resolve(firstRoot, 'template.ejs'), 'first <%= value %>')
    await writeFile(resolve(secondRoot, 'template.ejs'), 'second <%= value %>')
    await Promise.all([
      runBuild(firstRoot, generateFile({
        output: 'first.txt',
        type: 'template',
        template: 'template.ejs',
        data: { value: 'A' },
      })),
      runBuild(secondRoot, generateFile({
        output: 'second.txt',
        type: 'template',
        template: 'template.ejs',
        data: { value: 'B' },
      })),
    ])
    expect(await readFile(resolve(firstRoot, 'dist/first.txt'), 'utf8')).toBe('first A')
    expect(await readFile(resolve(secondRoot, 'dist/second.txt'), 'utf8')).toBe('second B')
    expect((await readdir(resolve(firstRoot, 'dist'))).sort()).toEqual(['first.txt', 'index.html'])
    expect((await readdir(resolve(secondRoot, 'dist'))).sort()).toEqual(['index.html', 'second.txt'])
  })

  it('isolates development middleware, templates and file lists between servers', async () => {
    const firstRoot = await createProject()
    const secondRoot = await createProject()
    await writeFile(resolve(firstRoot, 'template.ejs'), 'first <%= value %>')
    await writeFile(resolve(secondRoot, 'template.ejs'), 'second <%= value %>')
    const firstUrl = await startServer(firstRoot, generateFile({
      output: 'first.txt',
      type: 'template',
      template: 'template.ejs',
      data: { value: 'A' },
      contentType: 'text/custom',
    }))
    const secondUrl = await startServer(secondRoot, generateFile({
      output: 'second.txt',
      type: 'template',
      template: 'template.ejs',
      data: { value: 'B' },
    }))
    const firstResponse = await fetch(`${firstUrl}first.txt`)
    expect(await firstResponse.text()).toBe('first A')
    expect(firstResponse.headers.get('content-type')).toBe('text/custom')
    expect(await (await fetch(`${secondUrl}second.txt`)).text()).toBe('second B')
    const firstList = await (await fetch(`${firstUrl}__generate_file_list/`)).text()
    const secondList = await (await fetch(`${secondUrl}__generate_file_list/`)).text()
    expect(firstList).toContain('first.txt')
    expect(firstList).not.toContain('second.txt')
    expect(secondList).toContain('second.txt')
    expect(secondList).not.toContain('first.txt')
  })

  it('keeps an unconfigured development server empty after a configured server', async () => {
    const firstRoot = await createProject()
    const secondRoot = await createProject()
    await startServer(firstRoot, generateFile({ output: 'private.txt', type: 'raw', data: 'first project' }))
    const secondUrl = await startServer(secondRoot, generateFile())
    const list = await (await fetch(`${secondUrl}__generate_file_list/`)).text()
    expect(list).not.toContain('private.txt')
    expect(list).not.toContain('output.txt')
    expect(await (await fetch(`${secondUrl}private.txt`, {
      headers: { accept: 'application/json' },
    })).text()).not.toBe('first project')
  })
})
