import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** Create the parent directory for an output file. */
export function ensureDirectoryExistence(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

/** Strip Vite's base prefix from a request pathname. */
export function trimBasePath(filename: string, base: string): string {
  if (!base || base === '/') {
    return filename
  }

  const basePath = `${path.resolve(base)}/`
  if (filename.startsWith(basePath)) {
    return filename.slice(basePath.length - 1)
  }
  return filename
}
