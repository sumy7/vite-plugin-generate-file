import generateFile from 'vite-plugin-generate-file'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    generateFile([
      // json文件
      {
        type: 'json',
        output: 'jsonFile.json',
        data: {
          foo: 'hello',
          bar: 'world'
        }
      }
    ])]
})
