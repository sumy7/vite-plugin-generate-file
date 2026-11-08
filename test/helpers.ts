import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cacheRoot = fileURLToPath(new URL('../node_modules/.cache/vite-plugin-generate-file/tests/', import.meta.url))
const projects: string[] = []

export async function createProject(): Promise<string> {
  await mkdir(cacheRoot, { recursive: true })
  const root = await realpath(await mkdtemp(resolve(cacheRoot, 'project-')))
  projects.push(root)
  await writeFile(resolve(root, 'index.html'), '<html><body>Test application</body></html>')
  return root
}

export async function cleanupProjects(): Promise<void> {
  await Promise.all(projects.splice(0).map(root => rm(root, { recursive: true, force: true })))
}
