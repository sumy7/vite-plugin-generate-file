import { readFileSync, writeFile } from 'fs'
import { relative, resolve } from 'path'
import { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { green, yellow } from 'chalk'
import yaml from 'js-yaml'
import ejs from 'ejs'
import { ensureDirectoryExistence } from './utils'

// @ts-ignore
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
   * 文件输出格式，json-将data转换成JSON格式输出，yaml-将data转换成yaml格式输出，template-使用自定义模板，
   * 默认json格式
   */
  type?: 'json' | 'yaml' | 'template'
  /**
   * 输出使用的模板文件，在type为template时有效，无默认值
   */
  template?: string
  /**
   * 输出使用的data
   */
  data?: Record<string, any>
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
  return {
    ...generateFileOption,
    fullPath,
    relativePath,
  }
}

/**
 * 获取生成的文件内容
 * @param option 生成文件选项
 */
function generateContent(option: NormalizeGenerateFile): string {
  if (!option.type) {
    return ''
  }
  if (option.type === 'json') {
    if (option.data) {
      return JSON.stringify(option.data)
    }
    return ''
  }
  if (option.type === 'yaml') {
    if (option.data) {
      return yaml.dump(option.data)
    }
    return ''
  }
  if (option.type === 'template') {
    const templatePath = resolve(config.root, option.template!)
    const templateContent = readFileSync(templatePath, { encoding: 'utf8' })
    return ejs.render(templateContent, option.data)
  }
  console.warn(`Unknown type [${option.type}]`)
  return ''
}

/**
 * 生成文件
 * @param option 文件选项
 */
function generateFile(option: NormalizeGenerateFile) {
  const filePath = option.fullPath
  const fileContent = generateContent(option)
  ensureDirectoryExistence(filePath)
  writeFile(filePath, fileContent, { flag: 'w' }, (error) => {
    if (error) {
      throw error
    }

    console.log(`Generate File to ${green(filePath)}`)
  })
}

/**
 * 配置调试服务器
 */
function configureServer(server: ViteDevServer) {
  // 配置文件列表路由
  server.middlewares.use('/__generate_file_list', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(
      ejs.render(listTemplate, {
        generateFiles: Object.fromEntries(generateFileMap),
      })
    )
    res.end()
  })
  // 监测是否访问了生成的文件
  server.middlewares.use((req, res, next) => {
    const uri = new URL(req.originalUrl!, `http://${req.headers.host}`)
    const pathname = uri.pathname

    if (generateFileMap.has(pathname)) {
      const content = generateContent(generateFileMap.get(pathname)!)
      res.write(content)
      res.end()
    } else {
      next()
    }
  })

  const _server = server
  const _listen = server.httpServer!.listen
  let port = config.server.port || 3000
  let timer: any

  _server.httpServer!.listen = function listenWrapper(...args: any) {
    port ||= args[0]
    clearTimeout(timer)
    timer = setTimeout(() => {
      console.log(
        `  > Generate File List: ${yellow(
          `http://localhost:${port}/__generate_file_list/`
        )}\n`
      )
    }, 0)
    return _listen.apply(this, args)
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
      } else {
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
