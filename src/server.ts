import type { ViteDevServer } from 'vite'
import type { NormalizedFile } from './types.ts'
import ejs from 'ejs'
import pc from 'picocolors'
import { generateContent } from './files.ts'
import { trimBasePath } from './utils.ts'

const listTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Generate File List</title>
</head>
<body>
  <h1>Generate File List</h1>
  <ul>
    <% for (const [pathname, file] of files) { %>
      <li><a href="<%= pathname %>"><%= file.output %></a></li>
    <% } %>
  </ul>
</body>
</html>`

export function configureServer(server: ViteDevServer, files: Map<string, NormalizedFile>): void {
  server.middlewares.use((req, res, next) => {
    const { pathname } = new URL(req.originalUrl || req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const trimmedPathname = trimBasePath(pathname, server.config.base)
    if (trimmedPathname === '/__generate_file_list' || trimmedPathname.startsWith('/__generate_file_list/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(ejs.render(listTemplate, { files }))
      return
    }
    const file = files.get(pathname) || files.get(trimmedPathname)
    if (!file) {
      next()
      return
    }
    const content = generateContent(file, server.config.root)
    res.writeHead(200, { 'Content-Type': file.contentType })
    res.end(content)
  })

  const printUrls = server.printUrls.bind(server)
  server.printUrls = () => {
    printUrls()
    const fallback = `${server.config.server.https ? 'https' : 'http'}://localhost:${server.config.server.port || 80}`
    const origin = new URL(server.resolvedUrls?.local[0] || fallback).origin
    const url = `${origin}/__generate_file_list/`
    console.log(`  ${pc.green('➜')}  ${pc.bold('Generate File List')}: ${pc.green(url)}`)
  }
}
