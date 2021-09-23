import path from 'path'
import fs from 'fs'

/**
 * 根据路径，递归创建文件夹
 * https://stackoverflow.com/a/34509653/3671444
 *
 * @param filePath 文件路径
 */
export function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}
