# vite-plugin-generate-file

<p>
  <a href="https://npmjs.com/package/vite-plugin-generate-file">
    <img src="https://img.shields.io/npm/v/vite-plugin-generate-file?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="license" />
  <a href="https://npmcharts.com/compare/vite-plugin-generate-file?minimal=true"><img src="https://img.shields.io/npm/dm/vite-plugin-generate-file.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="downloads" /></a>
</p>

A Vite plugin to generate static files in the build output directory.

Generate JSON, YAML, EJS templates, or raw content, and preview the generated files through the development server.

## Usage

Install:

```bash
npm add vite-plugin-generate-file -D
```

> Since vite-plugin-generate-file@v0.1.0, Vite v3.1 or above is required.

Add the plugin to your `vite.config.ts`:

```ts
// vite.config.ts
import generateFile from 'vite-plugin-generate-file'

export default {
  plugins: [
    generateFile([
      {
        type: 'json',
        output: './output.txt',
        data: {
          foo: 'bar',
        },
      },
    ]),
  ],
}
```

## Options

Pass a file configuration object or an array of configurations to `generateFile`:

| Name | Description | Options | Defaults |
| --- | --- | --- | --- |
| `type` | Format of the generated file. | `json` `yaml` `template` `raw` | `json` |
| `output` | Output path relative to Vite's `build.outDir`, which defaults to `dist`. Nested directories are created automatically. | - | `./output.txt` |
| `template` | EJS template path relative to Vite's project root. Used when `type` is `template`. | - | - |
| `data` | Data to serialize or pass to the template. For `raw`, provide a string or a `Buffer`. | - | - |
| `contentType` | Content-Type returned by the development server. Inferred from the output extension when omitted, with `text/plain` as the fallback. | - | - |

When multiple configurations use the same output path, the last configuration takes precedence.

## Development Server

During development, generated files are served by middleware without being written to disk. Open `/__generate_file_list/` on your development server to browse the configured files.

Generated files are available both at their root-relative paths and under the configured Vite `base` prefix.

After a production build, the files are written to the configured output directory.

## Credits

This plugin was inspired
by [Alicevia/vite-plugin-generate-config-into-dist](https://github.com/fed/webpack-version-file)
and [antfu/vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect).

## License

MIT.
