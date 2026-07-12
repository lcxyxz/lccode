/**
 * 版本检查器测试
 *
 * 测试 src/utils/version-checker.ts 中的功能：
 * - checkForUpdate: 检查 npm 上是否有新版本
 * - getUpdateMessage: 生成更新提示消息
 *
 * 注意：checkForUpdate 会调用 npm registry API，
 * 测试使用 mock fetch 来避免真实网络请求
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ===================== Mock 设置 =====================

/**
 * 保存原始的 fetch 函数
 */
const originalFetch = globalThis.fetch

/**
 * mock 的 fetch 函数
 */
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch as any
})

afterEach(() => {
  // 恢复原始 fetch
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// ===================== getUpdateMessage 测试 =====================

describe('getUpdateMessage', () => {
  /**
   * 导入 getUpdateMessage 函数
   * 由于模块有缓存，每次测试前需要清除缓存
   */
  beforeEach(async () => {
    // 清除模块缓存，确保每次测试都是干净的状态
    vi.resetModules()
  })

  /**
   * 有新版本时应该返回更新提示消息
   */
  it('有新版本时应该返回更新提示', async () => {
    const { getUpdateMessage } = await import('../src/utils/version-checker.js')

    const result = getUpdateMessage({
      currentVersion: '0.0.1',
      latestVersion: '0.0.2',
      hasUpdate: true,
    })

    expect(result).toBeTruthy()
    expect(result).toContain('0.0.2')
    expect(result).toContain('npm install -g @lcxyxz/lccode@latest')
  })

  /**
   * 没有新版本时应该返回 null
   */
  it('没有新版本时应该返回 null', async () => {
    const { getUpdateMessage } = await import('../src/utils/version-checker.js')

    const result = getUpdateMessage({
      currentVersion: '0.0.2',
      latestVersion: '0.0.2',
      hasUpdate: false,
    })

    expect(result).toBeNull()
  })

  /**
   * latestVersion 为 null 时应该返回 null
   */
  it('latestVersion 为 null 时应该返回 null', async () => {
    const { getUpdateMessage } = await import('../src/utils/version-checker.js')

    const result = getUpdateMessage({
      currentVersion: '0.0.2',
      latestVersion: null,
      hasUpdate: false,
    })

    expect(result).toBeNull()
  })

  /**
   * hasUpdate=true 但 latestVersion=null 时应该返回 null
   */
  it('hasUpdate=true 但 latestVersion=null 时应该返回 null', async () => {
    const { getUpdateMessage } = await import('../src/utils/version-checker.js')

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
  beforeEach(async () => {
    vi.resetModules()
  })

  /**
   * 网络请求成功时应该返回版本信息
   */
  it('网络请求成功时应该返回版本信息', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    })

    const { checkForUpdate } = await import('../src/utils/version-checker.js')
    const result = await checkForUpdate()

    // 应该有 currentVersion（从 package.json 读取）
    expect(result.currentVersion).toBeTruthy()
    // 应该有 latestVersion
    expect(result.latestVersion).toBe('1.0.0')
    // 应该有 hasUpdate 标志
    expect(typeof result.hasUpdate).toBe('boolean')
  })

  /**
   * 网络请求失败时应该返回当前版本，latestVersion 为 null
   */
  it('网络请求失败时应该优雅处理', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { checkForUpdate } = await import('../src/utils/version-checker.js')
    const result = await checkForUpdate()

    // 应该有 currentVersion
    expect(result.currentVersion).toBeTruthy()
    // latestVersion 应该为 null
    expect(result.latestVersion).toBeNull()
    // hasUpdate 应该为 false
    expect(result.hasUpdate).toBe(false)
  })

  /**
   * HTTP 错误时应该优雅处理
   */
  it('HTTP 错误时应该优雅处理', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { checkForUpdate } = await import('../src/utils/version-checker.js')
    const result = await checkForUpdate()

    expect(result.latestVersion).toBeNull()
    expect(result.hasUpdate).toBe(false)
  })
})
