import { describe, it, expect } from 'vitest'
import { isCommandSafe, parseExecTag } from '../src/services/command-executor.js'

describe('isCommandSafe', () => {
  it('应该允许安全命令', () => {
    expect(isCommandSafe('ls').safe).toBe(true)
    expect(isCommandSafe('pwd').safe).toBe(true)
    expect(isCommandSafe('cat file.txt').safe).toBe(true)
    expect(isCommandSafe('git status').safe).toBe(true)
    expect(isCommandSafe('npm install').safe).toBe(true)
  })

  it('应该拦截不在白名单中的命令', () => {
    expect(isCommandSafe('rm file.txt').safe).toBe(false)
    expect(isCommandSafe('sudo apt install').safe).toBe(false)
  })

  it('应该拦截危险命令', () => {
    expect(isCommandSafe('rm -rf /').safe).toBe(false)
    expect(isCommandSafe('rm -rf').safe).toBe(false)
    expect(isCommandSafe('sudo rm -rf /').safe).toBe(false)
    expect(isCommandSafe('mkfs.ext4 /dev/sda').safe).toBe(false)
    expect(isCommandSafe('dd if=/dev/zero of=/dev/sda').safe).toBe(false)
    expect(isCommandSafe('chmod 777 /').safe).toBe(false)
  })

  it('应该处理带空格的命令', () => {
    expect(isCommandSafe('  ls -la  ').safe).toBe(true)
  })
})

describe('parseExecTag', () => {
  it('应该解析 <exec> 标签', () => {
    const result = parseExecTag('我帮你看一下：<exec>ls -la</exec>')
    expect(result).toEqual({
      before: '我帮你看一下：',
      command: 'ls -la',
      after: '',
    })
  })

  it('应该解析带前后文本的标签', () => {
    const result = parseExecTag('前缀<exec>pwd</exec>后缀')
    expect(result).toEqual({
      before: '前缀',
      command: 'pwd',
      after: '后缀',
    })
  })

  it('没有 exec 标签时返回 null', () => {
    const result = parseExecTag('这是一段普通文本')
    expect(result).toBeNull()
  })

  it('应该处理多行文本', () => {
    const result = parseExecTag('第一行\n<exec>ls</exec>\n第三行')
    expect(result).toEqual({
      before: '第一行',
      command: 'ls',
      after: '第三行',
    })
  })
})
