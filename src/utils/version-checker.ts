import { readFileSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { LCCODE_VERSION } from './version.generated.js'

function execAsync(command: string, options?: { timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, options ?? {}, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

const NPM_REGISTRY = 'https://registry.npmjs.org/@lcxyxz/lccode/latest'

let cachedResult: { currentVersion: string; latestVersion: string | null; hasUpdate: boolean } | null = null

export function getCurrentVersion(): string {
  return LCCODE_VERSION
}

function parseVersion(version: string): number[] {
  return version.replace(/[^0-9.]/g, '').split('.').map(Number)
}

function compareVersions(current: string, latest: string): number {
  const c = parseVersion(current)
  const l = parseVersion(latest)

  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const a = c[i] || 0
    const b = l[i] || 0
    if (a !== b) return a - b
  }
  return 0
}

export async function checkForUpdate(): Promise<{ currentVersion: string; latestVersion: string | null; hasUpdate: boolean }> {
  if (cachedResult) return cachedResult

  const currentVersion = getCurrentVersion()

  try {
    const res = await fetch(NPM_REGISTRY, {
      signal: AbortSignal.timeout(3000),
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const latestVersion: string = data.version

    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0
    cachedResult = { currentVersion, latestVersion, hasUpdate }
    return cachedResult
  } catch {
    cachedResult = { currentVersion, latestVersion: null, hasUpdate: false }
    return cachedResult
  }
}

export function getUpdateMessage(result: { currentVersion: string; latestVersion: string | null; hasUpdate: boolean }): string | null {
  if (!result.hasUpdate || !result.latestVersion) return null
  return `发现新版本 v${result.latestVersion}，正在自动更新...`
}

export async function autoUpdate(
  execFn: (command: string, options?: { timeout?: number }) => Promise<string> = execAsync
): Promise<boolean> {
  const result = await checkForUpdate()
  if (!result.hasUpdate || !result.latestVersion) return false

  try {
    await execFn('npm install -g @lcxyxz/lccode@latest', {
      timeout: 60000,
    })
    return true
  } catch {
    return false
  }
}


