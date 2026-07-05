/**
 * 日志系统模块
 * 输出到家目录 ~/.lccode/logs/，简洁格式便于调试
 */

import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

// 日志级别
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 获取默认日志目录
function getDefaultLogDir(): string {
  return join(homedir(), '.lccode', 'logs')
}

// 获取默认日志文件路径
function getDefaultLogFile(): string {
  return join(getDefaultLogDir(), 'agent-debug.log')
}

// 日志配置接口
export interface LoggerConfig {
  level?: LogLevel
  logFile?: string
}

/**
 * 日志类
 */
export class Logger {
  private level: LogLevel
  private logFile: string

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO
    this.logFile = config.logFile ?? getDefaultLogFile()

    // 确保日志目录存在
    const dir = dirname(this.logFile)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  getLogFile(): string {
    return this.logFile
  }

  private write(message: string): void {
    try {
      appendFileSync(this.logFile, message + '\n')
    } catch (error) {
      console.error('写入日志失败:', error)
    }
  }

  debug(message: string, data?: any): void {
    if (this.level > LogLevel.DEBUG) return
    this.write(message)
    if (data !== undefined) {
      this.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  info(message: string, data?: any): void {
    if (this.level > LogLevel.INFO) return
    this.write(message)
    if (data !== undefined) {
      this.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  warn(message: string, data?: any): void {
    if (this.level > LogLevel.WARN) return
    this.write(message)
    if (data !== undefined) {
      this.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  error(message: string, data?: any): void {
    if (this.level > LogLevel.ERROR) return
    this.write(message)
    if (data !== undefined) {
      this.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  /**
   * 清空日志文件
   */
  clear(): void {
    writeFileSync(this.logFile, '')
  }

  /**
   * 记录分隔线
   */
  separator(): void {
    this.write('='.repeat(60))
  }

  /**
   * 记录完整对话上下文
   */
  logConversation(userQuery: string, assistantAnswer: string, round: number): void {
    this.write('')
    this.separator()
    this.write(`[User Query] Round ${round}`)
    this.write(userQuery)
    this.write('')
    this.write('[Assistant Answer]')
    this.write(assistantAnswer)
    this.separator()
    this.write('')
  }
}
