/** CommonJS calls the factory directly; share its signature with the ESM entry. */
declare function generateFile(...args: Parameters<typeof import('./index.mjs').default>): ReturnType<typeof import('./index.mjs').default>

declare namespace generateFile {
  type GenerateFile = import('./index.mjs').GenerateFile
  type Options = import('./index.mjs').Options
}

export = generateFile
