# Contributing

Zoom Dialer Companion is a Windows desktop companion for Zoom Phone. It plays clips or local TTS into an active call by mixing microphone audio through a virtual microphone. It does not modify Zoom Phone or use undocumented Zoom APIs.

Authoritative docs live under [`docs/`](docs/README.md):

- [Architecture](docs/architecture.md)
- [Project plan](docs/project-plan.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)

## Repository structure

| Path                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `apps/desktop`             | Electron + React + TypeScript shell             |
| `apps/audio-sidecar`       | .NET 8 audio sidecar                            |
| `packages/shared-protocol` | Shared IPC protocol schemas and generated types |
| `docs/`                    | Specifications and roadmap                      |

## Prerequisites

- Windows 11
- Node.js 22 LTS and npm
- .NET 8 SDK
- VB-CABLE only when later audio work requires it

## Setup

```powershell
cd packages/shared-protocol
npm ci

cd ../../apps/desktop
npm ci

cd ../audio-sidecar
dotnet restore ZoomDialer.AudioSidecar.sln
```

## Build

```powershell
cd packages/shared-protocol
npm run build

cd ../../apps/desktop
npm run build

cd ../audio-sidecar
dotnet build ZoomDialer.AudioSidecar.sln -warnaserror
```

## Test

```powershell
cd packages/shared-protocol
npm test

cd ../../apps/desktop
npm test

cd ../audio-sidecar
dotnet test ZoomDialer.AudioSidecar.sln
```

## Formatting and lint

Follow [`.editorconfig`](.editorconfig) and the root Prettier config.

```powershell
cd packages/shared-protocol
npm run format:check
npm run lint

cd ../../apps/desktop
npm run format:check
npm run lint
npm run typecheck

cd ../audio-sidecar
dotnet format ZoomDialer.AudioSidecar.sln --verify-no-changes
```

## Commits

- Implement one roadmap task from [`docs/project-plan.md`](docs/project-plan.md) per commit.
- Keep commits focused and use concise imperative messages (for example, `feat(desktop): ...`, `docs: ...`, `ci: ...`).

## Pull requests

- Keep PRs small and scoped to one task.
- Describe what changed and how it was tested.
- Ensure the GitHub Actions CI workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is green.
