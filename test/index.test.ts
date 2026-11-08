import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'
import { build, createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import generateFile from '../src'
import type { Options } from '../src'

const roots: string[] = []
const servers: ViteDevServer[] = []
const cacheRoot = fileURLToPath(new URL('../node_modules/.cache/vite-plugin-generate-file/tests/', import.meta.url))
const emptyConfigurations = [
  { name: 'omitted options', createPlugin: () => generateFile() },
  { name: 'undefined', createPlugin: () => generateFile(undefined) },
  { name: 'an empty array', createPlugin: () => generateFile([]) },
]

async function createRoot() {
  await mkdir(cacheRoot, { recursive: true })
  const root = await realpath(await mkdtemp(resolve(cacheRoot, 'project-')))
  roots.push(root)
  await writeFile(resolve(root, 'index.html'), '<html><body>Test</body></html>')
  return root
}

async function runBuild(root: string, plugin: Plugin) {
  await build({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })
}

async function startServer(root: string, plugin: Plugin) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, preTransformRequests: false },
  })
  servers.push(server)
  await server.listen()
  return server.resolvedUrls!.local[0]
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('generated files', () => {
  it.each(emptyConfigurations)('does not generate files for $name', async ({ createPlugin }) => {
    const root = await createRoot()
    await runBuild(root, createPlugin())
    expect(await readdir(resolve(root, 'dist'))).toEqual(['index.html'])
  })

  it('preserves the default output for an explicit configuration object', async () => {
    const root = await createRoot()
    await runBuild(root, generateFile({}))
    expect(await readFile(resolve(root, 'dist/output.txt'), 'utf8')).toBe('')
  })

  it('generates supported formats and keeps the last duplicate output', async () => {
    const root = await createRoot()
    await writeFile(resolve(root, 'template.ejs'), 'Hello <%= name %>!')
    await runBuild(root, generateFile([
      { output: 'data.json', data: { value: 'old' } },
      { output: './data.json', data: { value: 'new' } },
      { output: 'data.yaml', type: 'yaml', data: { value: 'yaml' } },
      { output: 'nested/template.txt', type: 'template', template: 'template.ejs', data: { name: 'Vite' } },
      { output: 'raw.txt', type: 'raw', data: 'raw text' },
      { output: 'raw.bin', type: 'raw', data: Buffer.from([0, 255, 1]) },
    ]))
    expect(JSON.parse(await readFile(resolve(root, 'dist/data.json'), 'utf8'))).toEqual({ value: 'new' })
    expect(await readFile(resolve(root, 'dist/data.yaml'), 'utf8')).toBe('value: yaml\n')
    expect(await readFile(resolve(root, 'dist/nested/template.txt'), 'utf8')).toBe('Hello Vite!')
    expect(await readFile(resolve(root, 'dist/raw.txt'), 'utf8')).toBe('raw text')
    expect(await readFile(resolve(root, 'dist/raw.bin'))).toEqual(Buffer.from([0, 255, 1]))
  })

  it('does not carry files into a later build', async () => {
    const root = await createRoot()
    await runBuild(root, generateFile({ output: 'first.json', data: { first: true } }))
    await runBuild(root, generateFile({ output: 'second.json', data: { second: true } }))
    expect((await readdir(resolve(root, 'dist'))).sort()).toEqual(['index.html', 'second.json'])
  })

  it.each(emptyConfigurations)('does not carry files into a later build with $name', async ({ createPlugin }) => {
    const root = await createRoot()
    await runBuild(root, generateFile({ output: 'first.json', data: { first: true } }))
    await runBuild(root, createPlugin())
    expect(await readdir(resolve(root, 'dist'))).toEqual(['index.html'])
  })

  it('rebuilds its file list when reusing a plugin instance', async () => {
    const root = await createRoot()
    const options: Options = [{ output: 'first.json', data: { first: true } }]
    const plugin = generateFile(options)
    await runBuild(root, plugin)
    options.splice(0, 1, { output: 'second.json', data: { second: true } })
    await runBuild(root, plugin)
    expect((await readdir(resolve(root, 'dist'))).sort()).toEqual(['index.html', 'second.json'])
  })

  it('isolates roots and templates between concurrent builds', async () => {
    const firstRoot = await createRoot()
    const secondRoot = await createRoot()
    await writeFile(resolve(firstRoot, 'template.ejs'), 'first <%= value %>')
    await writeFile(resolve(secondRoot, 'template.ejs'), 'second <%= value %>')
    await Promise.all([
      runBuild(firstRoot, generateFile({ output: 'first.txt', type: 'template', template: 'template.ejs', data: { value: 'A' } })),
      runBuild(secondRoot, generateFile({ output: 'second.txt', type: 'template', template: 'template.ejs', data: { value: 'B' } })),
    ])
    expect(await readFile(resolve(firstRoot, 'dist/first.txt'), 'utf8')).toBe('first A')
    expect(await readFile(resolve(secondRoot, 'dist/second.txt'), 'utf8')).toBe('second B')
    expect((await readdir(resolve(firstRoot, 'dist'))).sort()).toEqual(['first.txt', 'index.html'])
    expect((await readdir(resolve(secondRoot, 'dist'))).sort()).toEqual(['index.html', 'second.txt'])
  })

  it('isolates development middleware, templates and file lists between servers', async () => {
    const firstRoot = await createRoot()
    const secondRoot = await createRoot()
    await writeFile(resolve(firstRoot, 'template.ejs'), 'first <%= value %>')
    await writeFile(resolve(secondRoot, 'template.ejs'), 'second <%= value %>')
    const firstUrl = await startServer(firstRoot, generateFile({ output: 'first.txt', type: 'template', template: 'template.ejs', data: { value: 'A' }, contentType: 'text/custom' }))
    const secondUrl = await startServer(secondRoot, generateFile({ output: 'second.txt', type: 'template', template: 'template.ejs', data: { value: 'B' } }))
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
    const firstRoot = await createRoot()
    const secondRoot = await createRoot()
    await startServer(firstRoot, generateFile({ output: 'private.txt', type: 'raw', data: 'first project' }))
    const secondUrl = await startServer(secondRoot, generateFile())
    const list = await (await fetch(`${secondUrl}__generate_file_list/`)).text()
    expect(list).not.toContain('private.txt')
    expect(list).not.toContain('output.txt')
    expect(await (await fetch(`${secondUrl}private.txt`, { headers: { accept: 'application/json' } })).text()).not.toBe('first project')
  })
})
