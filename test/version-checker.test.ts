/**
 * 版本检查器测试
 *
 * 测试 src/utils/version-checker.ts 中的功能：
 * - checkForUpdate: 检查 npm 上是否有新版本
 * - getUpdateMessage: 生成更新提示消息
 * - autoUpdate: 自动执行 npm 更新
 *
 * 注意：checkForUpdate 会调用 npm registry API，
 * 测试使用 mock fetch 来避免真实网络请求
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

// ===================== Mock 设置 =====================

const originalFetch = globalThis.fetch

let mockFetch: ReturnType<typeof vi.fn>

/** 模块内缓存（cachedResult）依赖每次导入新实例，用 query 参数破坏模块缓存 */
let moduleSeq = 0
function freshModule(): string {
  return `../src/utils/version-checker.js?fresh=${moduleSeq++}`
}

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch as any
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// ===================== getUpdateMessage 测试 =====================

describe('getUpdateMessage', () => {
  it('有新版本时应该返回正在更新的提示', async () => {
    const { getUpdateMessage } = await import(freshModule())

    const result = getUpdateMessage({
      currentVersion: '0.0.1',
      latestVersion: '0.0.2',
      hasUpdate: true,
    })

    expect(result).toBeTruthy()
    expect(result).toContain('0.0.2')
    expect(result).toContain('正在自动更新')
  })

  it('没有新版本时应该返回 null', async () => {
    const { getUpdateMessage } = await import(freshModule())

    const result = getUpdateMessage({
      currentVersion: '0.0.2',
      latestVersion: '0.0.2',
      hasUpdate: false,
    })

    expect(result).toBeNull()
  })

  it('latestVersion 为 null 时应该返回 null', async () => {
    const { getUpdateMessage } = await import(freshModule())

    const result = getUpdateMessage({
      currentVersion: '0.0.2',
      latestVersion: null,
      hasUpdate: false,
    })

    expect(result).toBeNull()
  })

  it('hasUpdate=true 但 latestVersion=null 时应该返回 null', async () => {
    const { getUpdateMessage } = await import(freshModule())

    const result = getUpdateMessage({
      currentVersion: '0.0.1',
      latestVersion: null,
      hasUpdate: true,
    })

    expect(result).toBeNull()
  })
})

// ===================== checkForUpdate 测试 =====================

describe('checkForUpdate', () => {
  it('网络请求成功时应该返回版本信息', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    })

    const { checkForUpdate } = await import(freshModule())
    const result = await checkForUpdate()

    expect(result.currentVersion).toBeTruthy()
    expect(result.latestVersion).toBe('1.0.0')
    expect(typeof result.hasUpdate).toBe('boolean')
  })

  it('网络请求失败时应该优雅处理', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { checkForUpdate } = await import(freshModule())
    const result = await checkForUpdate()

    expect(result.currentVersion).toBeTruthy()
    expect(result.latestVersion).toBeNull()
    expect(result.hasUpdate).toBe(false)
  })

  it('HTTP 错误时应该优雅处理', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { checkForUpdate } = await import(freshModule())
    const result = await checkForUpdate()

    expect(result.latestVersion).toBeNull()
    expect(result.hasUpdate).toBe(false)
  })
})

// ===================== autoUpdate 测试 =====================

describe('autoUpdate', () => {
  it('有新版本时应该执行 npm install 并返回 true', async () => {
    const mockExec = vi.fn().mockResolvedValue('')

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '99.0.0' }),
    })

    const { autoUpdate } = await import(freshModule())
    const result = await autoUpdate(mockExec)

    expect(result).toBe(true)
    expect(mockExec).toHaveBeenCalledWith(
      'npm install -g @lcxyxz/lccode@latest',
      { timeout: 60000 }
    )
  })

  it('没有新版本时应该返回 false', async () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf-8'))
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: pkg.version }),
    })

    const { autoUpdate } = await import(freshModule())
    const result = await autoUpdate()

    expect(result).toBe(false)
  })

  it('npm install 失败时应该返回 false', async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error('npm error'))

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '99.0.0' }),
    })

    const { autoUpdate } = await import(freshModule())
    const result = await autoUpdate(mockExec)

    expect(result).toBe(false)
  })
})
