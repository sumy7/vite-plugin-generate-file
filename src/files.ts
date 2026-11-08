import type { GenerateFile, NormalizedFile, Options } from './types.ts'
import { Buffer } from 'node:buffer'
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ejs from 'ejs'
import yaml from 'js-yaml'
import * as mime from 'mime-types'
import pc from 'picocolors'
import { ensureDirectoryExistence } from './utils.ts'

function normalizeFile(option: GenerateFile, outDir: string): NormalizedFile {
  const file: GenerateFile = {
    output: './output.txt',
    type: 'json',
    template: '',
    ...option,
  }
  const fullPath = resolve(outDir, file.output!)
  return {
    ...file,
    fullPath,
    relativePath: `/${relative(outDir, fullPath).replaceAll('\\', '/')}`,
    contentType: file.contentType || mime.lookup(file.output || '') || 'text/plain',
  }
}

export function resolveFiles(options: Options | undefined, outDir: string): Map<string, NormalizedFile> {
  const files = new Map<string, NormalizedFile>()
  if (options === undefined)
    return files

  for (const option of Array.isArray(options)
    ? options
    : [options]) {
    const file = normalizeFile(option, outDir)
    files.set(file.relativePath, file)
  }
  return files
}

export function generateContent(file: NormalizedFile, root: string): Buffer {
  switch (file.type) {
    case 'json':
      return Buffer.from(file.data
        ? JSON.stringify(file.data)
        : '', 'utf8')
    case 'yaml':
      return Buffer.from(file.data
        ? yaml.dump(file.data)
        : '', 'utf8')
    case 'template': {
      const template = readFileSync(resolve(root, file.template!), 'utf8')
      const data = typeof file.data === 'object' && file.data !== null
        ? file.data
        : {}
      return Buffer.from(ejs.render(template, data), 'utf8')
    }
    case 'raw':
      if (Buffer.isBuffer(file.data))
        return file.data
      return Buffer.from(typeof file.data === 'string'
        ? file.data
        : '', 'utf8')
    default:
      if (file.type)
        console.warn(`Unknown type [${file.type}]`)
      return Buffer.from('', 'utf8')
  }
}

export function writeFiles(files: Map<string, NormalizedFile>, root: string): void {
  for (const file of files.values()) {
    const content = generateContent(file, root)
    ensureDirectoryExistence(file.fullPath)
    writeFileSync(file.fullPath, content)
    console.log(`Generate File to ${pc.green(file.fullPath)}`)
  }
}
