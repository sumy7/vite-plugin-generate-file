# vite-plugin-generate-file

**vite-plugin-generate-file** is a vite plugin which generate static file and write them to dist folder after packaging.

## Usage

Install dev dependency :

```shell
yarn add vite-plugin-generate-file -D
npm install vite-plugin-generate-file -D
```

> Since vite-plugin-generate-file@v0.1.0, Vite v3.1 or above is required.

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

Here are the available options for configuration:

| Name          | Description                                                                                                                          | Options                   | Defaults       |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------|---------------------------|----------------|
| `type`        | Specifies the format type of the generated file.                                                                                     | `json`  `yaml` `template` | `json`         |
| `output`      | Defines the path to the output file that the plugin will generate. This path is relative to the `dist` folder.                       | -                         | `./output.txt` |
| `template`    | Specifies the path to the template file. Supports `ejs` format template. This option is available when `type` is set to `template`.  | -                         | -              |
| `data`        | Specifies the data to be used in the generated file or to be passed into the template.                                               | -                         | -              |
| `contentType` | Defines the Content-Type response returned from the dev server. If left empty, it will be inferred from the `output` path extension. | -                         | -              |

In dev mode, plugin will mock file by dev server.
See [localhost:5173/__generate_file_list/](http://localhost:5173/__generate_file_list/) for more detail.

## Credits

This plugin was inspired
by [Alicevia/vite-plugin-generate-config-into-dist](https://github.com/fed/webpack-version-file)
and [antfu/vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect)

## License

MIT
