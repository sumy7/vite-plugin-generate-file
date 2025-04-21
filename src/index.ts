import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { Buffer } from 'node:buffer'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import pc from 'picocolors'
import yaml from 'js-yaml'
import ejs from 'ejs'
import * as mime from 'mime-types'
import { ensureDirectoryExistence, trimBasePath } from './utils'

import listTemplate from './view.ejs'

/**
 * 文件输出配置
 */
export interface GenerateFile {
  /**
   * 文件输出位置，相对于输出目录，默认 ./output.txt
   */
  output?: string
  /**
   * 文件输出格式：
   * - json-将data转换成JSON格式输出
   * - yaml-将data转换成yaml格式输出
   * - template-使用自定义模板
   * - raw-原样输出
   *
   * 默认json格式
   */
  type?: 'json' | 'yaml' | 'template' | 'raw'
  /**
   * devServer访问时返回的ContentType，默认根据output路径扩展名进行猜测
   */
  contentType?: string
  /**
   * 输出使用的模板文件，在type为template时有效，无默认值
   */
  template?: string
  /**
   * 输出使用的data
   */
  data?: Record<string, any> | Buffer | string
}

/**
 * 处理后的配置项
 */
interface NormalizeGenerateFile extends GenerateFile {
  fullPath: string
  relativePath: string
}

export type Options = GenerateFile | GenerateFile[]

/**
 * 解析后的全局配置项
 */
let config: ResolvedConfig
/**
 * 文件生成根路径
 */
let distPath: string
/**
 * 文件生成配置，相同路径保留最后一个
 */
const generateFileMap = new Map<string, NormalizeGenerateFile>()

/**
 * 参数默认值
 * @param option 参数
 */
function normalizeOption(option: GenerateFile): NormalizeGenerateFile {
  const generateFileOption: GenerateFile = {
    output: './output.txt',
    type: 'json',
    template: '',
    ...option,
  }
  const fullPath = resolve(distPath, generateFileOption.output!)
  const relativePath = `/${relative(distPath, fullPath)}`
  const contentType
    = generateFileOption.contentType
    || mime.lookup(generateFileOption.output || '')
    || 'text/plain'
  return {
    ...generateFileOption,
    contentType,
    fullPath,
    relativePath,
  }
}

/**
 * 获取生成的文件内容
 * @param option 生成文件选项
 */
function generateContent(option: NormalizeGenerateFile): Buffer {
  if (!option.type) {
    return Buffer.from('', 'utf-8')
  }
  if (option.type === 'json') {
    if (option.data) {
      return Buffer.from(JSON.stringify(option.data), 'utf-8')
    }
    return Buffer.from('', 'utf-8')
  }
  if (option.type === 'yaml') {
    if (option.data) {
      return Buffer.from(yaml.dump(option.data), 'utf-8')
    }
    return Buffer.from('', 'utf-8')
  }
  if (option.type === 'template') {
    const templatePath = resolve(config.root, option.template!)
    const templateContent = readFileSync(templatePath, { encoding: 'utf8' })
    return Buffer.from(ejs.render(templateContent, typeof option.data === 'object' && option.data !== null ? option.data : {}), 'utf-8')
  }
  if (option.type === 'raw') {
    if (option.data) {
      if (Buffer.isBuffer(option.data)) {
        return option.data
      }
      if (typeof option.data === 'string') {
        return Buffer.from(option.data, 'utf-8')
      }
    }
    return Buffer.from('', 'utf-8')
  }
  console.warn(`Unknown type [${option.type}]`)
  return Buffer.from('', 'utf-8')
}

/**
 * 生成文件
 * @param option 文件选项
 */
function generateFile(option: NormalizeGenerateFile): void {
  const filePath = option.fullPath
  const fileContent = generateContent(option)
  ensureDirectoryExistence(filePath)
  // 使用同步模式写入文件
  writeFileSync(filePath, fileContent, { flag: 'w' })
  console.log(`Generate File to ${pc.green(filePath)}`)
}

/**
 * 配置调试服务器
 */
function configureServer(server: ViteDevServer): void {
  // 配置文件列表路由
  server.middlewares.use('/__generate_file_list', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(
      ejs.render(listTemplate, {
        generateFiles: Object.fromEntries(generateFileMap),
      }),
    )
    res.end()
  })
  // 监测是否访问了生成的文件
  server.middlewares.use((req, res, next) => {
    const uri = new URL(req.originalUrl!, `http://${req.headers.host}`)
    const pathname = uri.pathname
    const base = server.config.base || '/'
    const trimmedPathname = trimBasePath(pathname, base)

    if (generateFileMap.has(pathname) || generateFileMap.has(trimmedPathname)) {
      const option = generateFileMap.get(pathname)! || generateFileMap.get(trimmedPathname)!
      const content = generateContent(option)
      res.writeHead(200, {
        'Content-Type': option.contentType,
      })
      res.write(content)
      res.end()
    }
    else {
      next()
    }
  })

  const _print = server.printUrls
  server.printUrls = () => {
    let host = `${config.server.https ? 'https' : 'http'}://localhost:${
      config.server.port || '80'
    }`

    const url = server.resolvedUrls?.local[0]

    if (url) {
      try {
        const u = new URL(url)
        host = `${u.protocol}//${u.host}`
      }
      catch (error) {
        console.warn('Parse resolved url failed:', error)
      }
    }

    _print()

    const colorUrl = (url: string): string =>
      pc.green(url.replace(/:(\d+)\//, (_, port) => `:${pc.bold(port)}/`))

    console.log(
      `  ${pc.green('➜')}  ${pc.bold('Generate File List')}: ${colorUrl(
        `${host}/__generate_file_list/`,
      )}`,
    )
  }
}

/**
 * 插件入口
 */
function PluginGenerateFile(options: Options): Plugin {
  return {
    name: 'vite-plugin-generate-file',
    configResolved(resolvedConfig) {
      config = resolvedConfig
      distPath = resolve(config.root, config.build.outDir)

      if (Array.isArray(options)) {
        options.forEach((option) => {
          const simpleOption = normalizeOption(option)
          generateFileMap.set(simpleOption.relativePath, simpleOption)
        })
      }
      else {
        const simpleOption = normalizeOption(options)
        generateFileMap.set(simpleOption.relativePath, simpleOption)
      }
    },
    closeBundle() {
      // 存在测试服务器时不需要生成文件
      if (config.command === 'serve') {
        return
      }
      // 按顺序生成文件
      for (const option of generateFileMap.values()) {
        generateFile(option)
      }
    },
    configureServer,
  }
}

export default PluginGenerateFile
