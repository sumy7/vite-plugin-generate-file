import path from 'node:path'
import fs from 'node:fs'

/**
 * 根据路径，递归创建文件夹
 * https://stackoverflow.com/a/34509653/3671444
 *
 * @param filePath 文件路径
 */
export function ensureDirectoryExistence(filePath: string): void {
  const dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

/**
 * 去除文件路径的base部分
 * @param filename 文件路径
 * @param base base路径
 */
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
