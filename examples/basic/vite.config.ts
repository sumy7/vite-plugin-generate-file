import { Buffer } from 'node:buffer'
import { defineConfig } from 'vite'

export default defineConfig(async ({ command, isPreview }) => {
  const { default: generateFile } = command === 'serve' && !isPreview
    ? await import('../../src/index.ts')
    : await import('vite-plugin-generate-file')

  return {
    base: '/generate-file/',
    plugins: [
      generateFile([
        {
          output: 'data.json',
          type: 'json',
          data: { message: 'Hello from JSON.' },
        },
        {
          output: 'data.yaml',
          type: 'yaml',
          data: { message: 'Hello from YAML.' },
        },
        {
          output: 'raw.txt',
          type: 'raw',
          data: 'Hello from a raw string.\n',
        },
        {
          output: 'buffer.txt',
          type: 'raw',
          data: Buffer.from('Hello from a Buffer.\n'),
        },
        {
          output: 'greeting.txt',
          type: 'template',
          template: 'src/template/greeting.ejs',
          data: { name: 'Vite' },
        },
      ]),
    ],
  }
})
