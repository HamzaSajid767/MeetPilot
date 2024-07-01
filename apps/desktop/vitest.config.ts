import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Sidecar integration tests stage/spawn a .NET host; keep files sequential to avoid pipe races.
    fileParallelism: false
  }
})
