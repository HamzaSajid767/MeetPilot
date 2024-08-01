import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let cachedBuiltDll: string | null = null

function unblockDirectory(dir: string): void {
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-ChildItem -LiteralPath '${dir.replace(/'/g, "''")}' -Recurse -Include *.dll,*.exe -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue`
    ],
    { windowsHide: true, encoding: 'utf8' }
  )
}

/**
 * Prefer the Debug build under the repo (after Unblock-File), falling back to a TEMP Release build.
 * Windows Application Control may block freshly built binaries until Unblock-File runs.
 */
export function resolveStagedSidecarDll(): string | null {
  if (cachedBuiltDll && existsSync(cachedBuiltDll)) {
    return cachedBuiltDll
  }

  const override = process.env.ZOOM_DIALER_SIDECAR_PATH
  if (override && existsSync(override)) {
    unblockDirectory(path.dirname(override))
    cachedBuiltDll = override
    return cachedBuiltDll
  }

  const debugDll = path.resolve(
    __dirname,
    '../../audio-sidecar/src/ZoomDialer.AudioSidecar/bin/Debug/net8.0-windows/ZoomDialer.AudioSidecar.dll'
  )
  if (existsSync(debugDll)) {
    unblockDirectory(path.dirname(debugDll))
    cachedBuiltDll = debugDll
    return cachedBuiltDll
  }

  const project = path.resolve(
    __dirname,
    '../../audio-sidecar/src/ZoomDialer.AudioSidecar/ZoomDialer.AudioSidecar.csproj'
  )
  if (!existsSync(project)) {
    return null
  }

  const outDir = path.join(
    os.tmpdir(),
    `zoom-dialer-sidecar-build-${process.pid}-${randomBytes(4).toString('hex')}`
  )
  mkdirSync(outDir, { recursive: true })

  const build = spawnSync(
    'dotnet',
    ['build', project, '-c', 'Release', '-o', outDir, '-warnaserror', '--verbosity', 'quiet'],
    {
      encoding: 'utf8',
      windowsHide: true
    }
  )
  if (build.status !== 0) {
    const detail = `${build.stdout ?? ''}\n${build.stderr ?? ''}`.trim()
    throw new Error(`Failed to build sidecar for integration tests.\n${detail}`)
  }

  unblockDirectory(outDir)
  const dll = path.join(outDir, 'ZoomDialer.AudioSidecar.dll')
  if (!existsSync(dll)) {
    return null
  }

  cachedBuiltDll = dll
  return cachedBuiltDll
}

export function resolveToneFixture(): string {
  const source = path.resolve(
    __dirname,
    '../../audio-sidecar/tests/ZoomDialer.AudioSidecar.Tests/fixtures/tone.wav'
  )
  const localDir = path.resolve(__dirname, 'fixtures')
  const local = path.join(localDir, 'tone.wav')
  mkdirSync(localDir, { recursive: true })
  if (existsSync(source) && !existsSync(local)) {
    try {
      copyFileSync(source, local)
    } catch {
      // Fall through; prefer source when local copy is locked.
    }
  }
  return existsSync(local) ? local : source
}

export async function startStagedSidecar(
  pipeName: string,
  dll: string,
  children: ChildProcessWithoutNullStreams[],
  settleMs = 1000
): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn('dotnet', [dll, '--pipe-name', pipeName], {
    windowsHide: true,
    stdio: 'pipe',
    cwd: path.dirname(dll),
    env: {
      ...process.env,
      DOTNET_ENVIRONMENT: 'Development'
    }
  })
  children.push(child)
  await new Promise((resolve) => setTimeout(resolve, settleMs))
  if (child.exitCode !== null) {
    throw new Error(
      `Sidecar exited early with code ${child.exitCode}. Ensure binaries are Unblock-File'd (WDAC).`
    )
  }
  return child
}
