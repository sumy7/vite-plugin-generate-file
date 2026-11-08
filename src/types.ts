import type { Buffer } from 'node:buffer'

/** Configuration for one generated file. */
export interface GenerateFile {
  /** Output path relative to Vite's build.outDir. @default './output.txt' */
  output?: string
  /** Serialization format. @default 'json' */
  type?: 'json' | 'yaml' | 'template' | 'raw'
  /** Development response content type; inferred from the output extension. */
  contentType?: string
  /** EJS template path relative to Vite's root. */
  template?: string
  /** Data to serialize, render, or write as raw content. */
  data?: Record<string, any> | Buffer | string
}

export type Options = GenerateFile | GenerateFile[]

/** Resolved paths and response metadata for an output file. */
export interface NormalizedFile extends GenerateFile {
  fullPath: string
  relativePath: string
  contentType: string
}
