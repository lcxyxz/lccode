import { describe, it, expect } from 'vitest'
import { isCommandSafe } from '../src/services/command-executor.js'

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
