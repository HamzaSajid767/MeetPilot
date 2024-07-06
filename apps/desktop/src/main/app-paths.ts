import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { APP_PATH_NAMES } from '../shared/protocol'

export type DirectoryCreator = (
  targetPath: string,
  options: { recursive: true }
) => Promise<string | undefined>

export interface ResolvedAppPaths {
  readonly root: string
  readonly config: string
  readonly database: string
  readonly logs: string
  readonly assets: string
  readonly phrases: string
  readonly cache: string
  readonly temp: string
  readonly imports: string
  readonly exports: string
}

function assertAbsoluteBase(appDataBase: string): string {
  if (typeof appDataBase !== 'string' || appDataBase.trim().length === 0) {
    throw new Error('Application data base path must be a non-empty string')
  }

  if (appDataBase.includes('\0')) {
    throw new Error('Application data base path must not contain null bytes')
  }

  if (!path.isAbsolute(appDataBase)) {
    throw new Error(`Application data base path must be absolute: ${appDataBase}`)
  }

  return path.normalize(path.resolve(appDataBase))
}

export class AppPathsService implements ResolvedAppPaths {
  readonly root: string
  readonly config: string
  readonly database: string
  readonly logs: string
  readonly assets: string
  readonly phrases: string
  readonly cache: string
  readonly temp: string
  readonly imports: string
  readonly exports: string

  private readonly createDirectory: DirectoryCreator
  private ensurePromise: Promise<void> | undefined

  constructor(
    appDataBase: string,
    createDirectory: DirectoryCreator = mkdir,
    names: typeof APP_PATH_NAMES = APP_PATH_NAMES
  ) {
    const base = assertAbsoluteBase(appDataBase)
    this.root = path.normalize(path.join(base, names.rootDirectoryName))
    this.config = path.normalize(path.join(this.root, names.config))
    this.database = path.normalize(path.join(this.root, names.database))
    this.logs = path.normalize(path.join(this.root, names.logs))
    this.assets = path.normalize(path.join(this.root, names.assets))
    this.phrases = path.normalize(path.join(this.root, names.phrases))
    this.cache = path.normalize(path.join(this.root, names.cache))
    this.temp = path.normalize(path.join(this.root, names.temp))
    this.imports = path.normalize(path.join(this.root, names.imports))
    this.exports = path.normalize(path.join(this.root, names.exports))
    this.createDirectory = createDirectory
  }

  listDirectories(): readonly string[] {
    return [
      this.root,
      this.config,
      this.database,
      this.logs,
      this.assets,
      this.phrases,
      this.cache,
      this.temp,
      this.imports,
      this.exports
    ]
  }

  async ensureCreated(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = this.createAll().catch((error: unknown) => {
        this.ensurePromise = undefined
        throw error
      })
    }

    await this.ensurePromise
  }

  private async createAll(): Promise<void> {
    for (const directory of this.listDirectories()) {
      await this.createDirectory(directory, { recursive: true })
    }
  }
}

export function createAppPathsService(
  appDataBase: string,
  createDirectory?: DirectoryCreator
): AppPathsService {
  return new AppPathsService(appDataBase, createDirectory)
}
