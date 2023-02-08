# vite-plugin-generate-file

**vite-plugin-generate-file** is a vite plugin which generate static file and write them to dist folder after packaging.

## Usage

Install dev dependency :

```shell
yarn add vite-plugin-generate-file -D
npm install vite-plugin-generate-file -D
```

Add plugin to your `vite.config.ts` :

```typescript
// vite.config.ts
import generateFile from 'vite-plugin-generate-file'

export default {
  plugins: [
    generateFile([{
      type: 'json',
      output: './output.txt',
      data: {
        foo: 'bar'
      }
    }])
  ]
}
```

Available options:

| Name          | Description                                                                                                 | Options                   | Defaults       |
|---------------|-------------------------------------------------------------------------------------------------------------|---------------------------|----------------|
| `type`        | Generate file format type.                                                                                  | `json`  `yaml` `template` | `json`         |
| `output`      | Path to the output file the plugin will generate. It relative to `dist` folder.                             | -                         | `./output.txt` |
| `template`    | Path to the template file. Support `ejs` format template. Available while `type` is `template`.             | -                         | -              |
| `data`        | Data to use in generated file or be passed in to the template.                                              | -                         | -              |
| `contentType` | Response Content-Type return from dev server. If empty it will be guessed from the `output` path extension. | -                         | -              |

In dev mode, plugin will mock file by dev server. See [localhost:3000/__generate_file_list/](http://localhost:3000/__generate_file_list/) for more detail.

## Credits

This plugin was inspired
by [Alicevia/vite-plugin-generate-config-into-dist](https://github.com/fed/webpack-version-file)
and [antfu/vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect)

## License

MIT
