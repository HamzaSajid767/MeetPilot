import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileFromFile } from 'json-schema-to-typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const schemaDir = path.join(root, 'schema')
const outDir = path.join(root, 'src', 'generated')

await mkdir(outDir, { recursive: true })

const schemaFiles = (await readdir(schemaDir))
  .filter((name) => name.endsWith('.schema.json'))
  .sort()

const banner = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GENERATED FILE. DO NOT EDIT.',
  ' * Source of truth: packages/shared-protocol/schema',
  ' */',
  ''
].join('\n')

for (const fileName of schemaFiles) {
  const schemaPath = path.join(schemaDir, fileName)
  const baseName = fileName.replace(/\.schema\.json$/, '')
  const outFile = path.join(outDir, `${baseName}.ts`)
  const compiled = await compileFromFile(schemaPath, {
    bannerComment: '',
    cwd: schemaDir,
    style: {
      singleQuote: true,
      semi: false,
      trailingComma: 'none'
    },
    unreachableDefinitions: true,
    unknownAny: false
  })

  await writeFile(outFile, `${banner}${compiled}`, 'utf8')
}

const constantsJson = JSON.parse(
  await readFile(path.join(schemaDir, 'protocol.constants.json'), 'utf8')
)
const constantsTs = `${banner}export const protocolConstants = ${JSON.stringify(
  constantsJson,
  null,
  2
)} as const\n`
await writeFile(path.join(outDir, 'protocol.constants.ts'), constantsTs, 'utf8')

const appPathsJson = JSON.parse(
  await readFile(path.join(schemaDir, 'app-paths.constants.json'), 'utf8')
)
const appPathsTs = `${banner}export const appPathConstants = ${JSON.stringify(
  appPathsJson,
  null,
  2
)} as const\n`
await writeFile(path.join(outDir, 'app-paths.constants.ts'), appPathsTs, 'utf8')

console.log(`Generated ${schemaFiles.length} schema modules into src/generated`)
