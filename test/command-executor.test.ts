/**
 * 命令执行模块测试
 *
 * 测试 src/services/command-executor.ts 中的所有功能：
 * - executeCommand: 安全执行命令并返回结果
 * - getPlatform: 获取当前操作系统平台
 *
 * 注意：沙箱拦截通过 validateCommand 间接测试，
 * 默认配置下 absolute_paths 权限已启用，ls / 等命令会被放行
 */
import { describe, it, expect } from 'vitest'
import { executeCommand, getPlatform } from '../src/services/command-executor.js'

// ===================== executeCommand 测试 =====================

describe('executeCommand', () => {

  // ---------- 安全命令白名单测试 ----------

  describe('安全命令白名单', () => {
    it('应该允许执行 ls 命令（工作区内路径）', async () => {
      const result = await executeCommand('ls .')
      expect(result.success).toBe(true)
      expect(result.command).toBe('ls .')
      expect(result.stdout).toBeTruthy()
    })

    it('应该允许执行 pwd 命令', async () => {
      const result = await executeCommand('pwd')
      expect(result.success).toBe(true)
      expect(result.stdout).toBeTruthy()
    })

    it('应该允许执行 echo 命令', async () => {
      const result = await executeCommand('echo hello')
      expect(result.success).toBe(true)
      expect(result.stdout).toBe('hello')
    })

    it('应该允许执行 git status 命令', async () => {
      const result = await executeCommand('git status')
      expect(result.command).toBe('git status')
    })

    it('应该允许执行带参数的命令（工作区内路径）', async () => {
      const result = await executeCommand('ls -la .')
      expect(result.success).toBe(true)
    })
  })

  // ---------- 危险命令拦截测试 ----------

  describe('危险命令拦截', () => {
    /**
     * deniedCommandPatterns 匹配的命令由自定义规则拦截
     * 这些命令会被沙箱拒绝，不会执行
     */
    it('sudo apt install 应被自定义规则拦截', async () => {
      const result = await executeCommand('sudo apt install vim')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
      expect(result.error).toContain('自定义规则拒绝')
    })

    it('rm -rf / 应被自定义规则拦截', async () => {
      const result = await executeCommand('rm -rf /')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('sudo rm 应被自定义规则拦截', async () => {
      const result = await executeCommand('sudo rm -rf /home')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('mkfs 应被自定义规则拦截', async () => {
      const result = await executeCommand('mkfs.ext4 /dev/sda')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('dd if= 应被自定义规则拦截', async () => {
      const result = await executeCommand('dd if=/dev/zero of=/dev/sda')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
      expect(result.error).toContain('自定义规则拒绝')
    })

    it('文件重定向应被沙箱拦截', async () => {
      const result = await executeCommand('> /etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('管道到 shell 应被自定义规则拦截', async () => {
      const result = await executeCommand('echo hello | bash')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
      expect(result.error).toContain('自定义规则拒绝')
    })
  })

  // ---------- 命令执行但系统拒绝 ----------

  describe('命令通过沙箱但系统拒绝', () => {
    /**
     * 默认配置 absolute_paths 权限已启用，
     * ls / 通过沙箱检查但实际执行时系统会执行（ls / 在 Linux 上合法）
     */
    it('ls / 通过沙箱并在 Linux 上执行成功', async () => {
      const result = await executeCommand('ls /')
      expect(result.success).toBe(true)
      expect(result.stdout).toBeTruthy()
    })

    /**
     * rm 不在 deniedCommandPatterns 中，通过沙箱检查，
     * 但实际执行时因文件不存在而失败
     */
    it('rm file.txt 通过沙箱但因文件不存在而失败', async () => {
      const result = await executeCommand('rm file.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('rm')
    })

    /**
     * rm -rf 不在 deniedCommandPatterns 中（需要后跟 / 才匹配），
     * 通过沙箱检查，实际执行时因缺少操作数而失败
     */
    it('rm -rf 不带路径通过沙箱并在 Linux 上执行成功', async () => {
      const result = await executeCommand('rm -rf')
      expect(result.success).toBe(true)
    })

    /**
     * chmod 不在 deniedCommandPatterns 中，通过沙箱检查，
     * 但实际执行时因权限不足而失败
     */
    it('chmod 777 / 通过沙箱但因权限不足而失败', async () => {
      const result = await executeCommand('chmod 777 /')
      expect(result.success).toBe(false)
      expect(result.error).toContain('chmod')
    })
  })

  // ---------- force 参数测试 ----------

  describe('force 参数', () => {
    it('force=true 应该跳过安全检查执行命令', async () => {
      const result = await executeCommand('echo forced', true)
      expect(result.success).toBe(true)
      expect(result.stdout).toBe('forced')
    })

    it('force=true 应该能执行非白名单命令', async () => {
      const result = await executeCommand('touch /tmp/test-lccode-force.txt', true)
      expect(result.success).toBe(true)
    })
  })

  // ---------- 命令执行结果测试 ----------

  describe('命令执行结果', () => {
    it('应该返回完整的 CommandResult 结构', async () => {
      const result = await executeCommand('echo test')
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('command')
      expect(result).toHaveProperty('stdout')
      expect(result).toHaveProperty('stderr')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.command).toBe('string')
      expect(typeof result.stdout).toBe('string')
      expect(typeof result.stderr).toBe('string')
    })

    it('应该对输出进行 trim 处理', async () => {
      const result = await executeCommand('echo "  hello  "')
      expect(result.stdout).toBe('hello')
    })

    it('失败的命令应该包含 error 字段', async () => {
      const result = await executeCommand('nonexistent_command_xyz')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ---------- 超时测试 ----------

  describe('超时处理', () => {
    it('超时的命令应该返回失败', async () => {
      const result = await executeCommand('sleep 55')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    }, 60000)
  })
})

// ===================== getPlatform 测试 =====================

describe('getPlatform', () => {
  it('应该返回当前平台', () => {
    const platform = getPlatform()
    expect(['linux', 'windows', 'darwin']).toContain(platform)
  })

  it('在 Linux 环境下应该返回 linux', () => {
    expect(getPlatform()).toBe('linux')
  })
})
