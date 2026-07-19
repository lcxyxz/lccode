/**
 * 命令执行模块测试
 *
 * 测试 src/services/command-executor.ts 中的所有功能：
 * - executeCommand: 安全执行命令并返回结果
 * - getPlatform: 获取当前操作系统平台
 *
 * 注意：isCommandSafe 是内部函数，通过 executeCommand 间接测试
 */
import { describe, it, expect } from 'vitest'
import { executeCommand, getPlatform } from '../src/services/command-executor.js'

// ===================== executeCommand 测试 =====================

describe('executeCommand', () => {

  // ---------- 安全命令白名单测试 ----------

  describe('安全命令白名单', () => {
    /**
     * 白名单内的命令应该正常执行
     * 这些是被允许执行的基础命令
     */
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
      // git status 可能成功也可能失败（取决于是否在 git 仓库中）
      // 但命令本身应该被允许执行
      expect(result.command).toBe('git status')
    })

    it('应该允许执行带参数的命令（工作区内路径）', async () => {
      const result = await executeCommand('ls -la .')
      expect(result.success).toBe(true)
    })

    it('沙箱应拦截访问工作区外绝对路径的命令', async () => {
      const result = await executeCommand('ls /')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })
  })

  // ---------- 危险命令拦截测试 ----------

  describe('危险命令拦截', () => {
    /**
     * 不在白名单中的命令应该被拦截
     */
    it('应该拦截不在白名单中的命令', async () => {
      const result = await executeCommand('rm file.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不在安全列表中')
    })

    it('应该拦截 sudo 命令', async () => {
      const result = await executeCommand('sudo apt install vim')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不在安全列表中')
    })

    /**
     * 危险模式匹配的命令应该被拦截
     * 沙箱在最外层：包含绝对路径的危险命令会被沙箱先拦截，
     * 不含绝对路径的危险命令由 isCommandSafe 拦截
     */
    it('应该拦截 rm -rf / 命令', async () => {
      const result = await executeCommand('rm -rf /')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('应该拦截 rm -rf 命令（不带路径）', async () => {
      const result = await executeCommand('rm -rf')
      expect(result.success).toBe(false)
      expect(result.error).toContain('危险命令被拦截')
    })

    it('应该拦截 sudo rm 命令', async () => {
      const result = await executeCommand('sudo rm -rf /home')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('应该拦截 mkfs 命令', async () => {
      const result = await executeCommand('mkfs.ext4 /dev/sda')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('应该拦截 dd if= 命令', async () => {
      const result = await executeCommand('dd if=/dev/zero of=/dev/sda')
      expect(result.success).toBe(false)
      // dd 的参数格式为 if=path，不会被 extractPaths 提取，由 isCommandSafe 拦截
      expect(result.error).toContain('危险命令被拦截')
    })

    it('应该拦截 chmod 777 命令', async () => {
      const result = await executeCommand('chmod 777 /')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('应该拦截文件重定向命令', async () => {
      const result = await executeCommand('> /etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toContain('沙箱拦截')
    })

    it('应该拦截管道到 shell 的命令', async () => {
      const result = await executeCommand('echo hello | bash')
      expect(result.success).toBe(false)
      expect(result.error).toContain('危险命令被拦截')
    })
  })

  // ---------- force 参数测试 ----------

  describe('force 参数', () => {
    /**
     * force=true 时跳过安全检查，直接执行命令
     * 用于用户已确认的情况
     */
    it('force=true 应该跳过安全检查执行命令', async () => {
      const result = await executeCommand('echo forced', true)
      expect(result.success).toBe(true)
      expect(result.stdout).toBe('forced')
    })

    it('force=true 应该能执行非白名单命令', async () => {
      // touch 不在白名单中，但 force=true 时应该能执行
      const result = await executeCommand('touch /tmp/test-lccode-force.txt', true)
      expect(result.success).toBe(true)
    })
  })

  // ---------- 命令执行结果测试 ----------

  describe('命令执行结果', () => {
    /**
     * 验证返回结果的结构
     */
    it('应该返回完整的 CommandResult 结构', async () => {
      const result = await executeCommand('echo test')

      // 验证所有必要字段都存在
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('command')
      expect(result).toHaveProperty('stdout')
      expect(result).toHaveProperty('stderr')

      // 验证字段类型
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.command).toBe('string')
      expect(typeof result.stdout).toBe('string')
      expect(typeof result.stderr).toBe('string')
    })

    /**
     * stdout 和 stderr 应该被 trim 处理
     */
    it('应该对输出进行 trim 处理', async () => {
      const result = await executeCommand('echo "  hello  "')
      expect(result.stdout).toBe('hello')
    })

    /**
     * 失败的命令应该包含 error 字段
     */
    it('失败的命令应该包含 error 字段', async () => {
      const result = await executeCommand('nonexistent_command_xyz')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ---------- 超时测试 ----------

  describe('超时处理', () => {
    /**
     * 命令应该有 10 秒超时限制
     * sleep 15 会超时
     */
    it('超时的命令应该返回失败', async () => {
      const result = await executeCommand('sleep 15')
      expect(result.success).toBe(false)
    }, 15000) // 测试本身也需要更长的超时
  })
})

// ===================== getPlatform 测试 =====================

describe('getPlatform', () => {
  /**
   * getPlatform 应该返回当前操作系统平台
   * 在 Linux 环境下应该返回 'linux'
   */
  it('应该返回当前平台', () => {
    const platform = getPlatform()
    // 应该是三个有效值之一
    expect(['linux', 'windows', 'darwin']).toContain(platform)
  })

  /**
   * 在当前测试环境中（Linux），应该返回 'linux'
   */
  it('在 Linux 环境下应该返回 linux', () => {
    // 由于测试在 Linux 上运行
    expect(getPlatform()).toBe('linux')
  })
})
