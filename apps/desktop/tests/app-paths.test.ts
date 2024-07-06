import { mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_PATH_NAMES } from '../src/shared/protocol'
import { AppPathsService, createAppPathsService } from '../src/main/app-paths'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true })
    })
  )
})

async function createTempAppData(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zoom-dialer-appdata-'))
  tempRoots.push(root)
  return root
}

describe('AppPathsService', () => {
  it('resolves the documented application directory tree', async () => {
    const appData = await createTempAppData()
    const service = createAppPathsService(appData)

    expect(service.root).toBe(path.join(appData, APP_PATH_NAMES.rootDirectoryName))
    expect(service.config).toBe(path.join(service.root, APP_PATH_NAMES.config))
    expect(service.database).toBe(path.join(service.root, APP_PATH_NAMES.database))
    expect(service.logs).toBe(path.join(service.root, APP_PATH_NAMES.logs))
    expect(service.assets).toBe(path.join(service.root, APP_PATH_NAMES.assets))
    expect(service.phrases).toBe(path.join(service.root, APP_PATH_NAMES.phrases))
    expect(service.cache).toBe(path.join(service.root, APP_PATH_NAMES.cache))
    expect(service.temp).toBe(path.join(service.root, APP_PATH_NAMES.temp))
    expect(service.imports).toBe(path.join(service.root, APP_PATH_NAMES.imports))
    expect(service.exports).toBe(path.join(service.root, APP_PATH_NAMES.exports))
  })

  it('creates missing directories and remains idempotent', async () => {
    const appData = await createTempAppData()
    const service = createAppPathsService(appData)

    await service.ensureCreated()
    await service.ensureCreated()

    const children = await readdir(service.root)
    expect(children.sort()).toEqual(
      [
        APP_PATH_NAMES.assets,
        APP_PATH_NAMES.cache,
        APP_PATH_NAMES.config,
        APP_PATH_NAMES.database,
        APP_PATH_NAMES.exports,
        APP_PATH_NAMES.imports,
        APP_PATH_NAMES.logs,
        APP_PATH_NAMES.phrases,
        APP_PATH_NAMES.temp
      ].sort()
    )
  })

  it('memoizes concurrent ensureCreated calls', async () => {
    const created: string[] = []
    const createDirectory = vi.fn(async (targetPath: string) => {
      created.push(targetPath)
      return targetPath
    })

    const service = new AppPathsService(path.resolve('/tmp/appdata-base'), createDirectory)
    await Promise.all([service.ensureCreated(), service.ensureCreated(), service.ensureCreated()])

    expect(createDirectory).toHaveBeenCalledTimes(service.listDirectories().length)
    expect(new Set(created).size).toBe(service.listDirectories().length)
  })

  it('rejects relative and empty base paths', () => {
    expect(() => createAppPathsService('relative/appdata')).toThrow(/absolute/i)
    expect(() => createAppPathsService('')).toThrow(/non-empty/i)
    expect(() => createAppPathsService('   ')).toThrow(/non-empty/i)
    expect(() => createAppPathsService('C:\\path\0bad')).toThrow(/null bytes/i)
  })
})
