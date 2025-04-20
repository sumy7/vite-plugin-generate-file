import { Buffer } from 'node:buffer'
import generateFile from 'vite-plugin-generate-file'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    generateFile([
      // json文件
      {
        type: 'json',
        output: 'jsonFile.json',
        data: {
          foo: 'hello',
          bar: 'world',
        },
      },
      // raw
      {
        type: 'raw',
        output: 'rawFile.txt',
        data: 'hello world',
      },
      // raw Buffer
      {
        type: 'raw',
        output: 'rawFileBuffer.txt',
        data: Buffer.from('hello world'),
      },
    ]),
  ],
})
