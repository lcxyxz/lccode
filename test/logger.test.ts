/**
 * 日志系统测试
 *
 * 测试 src/utils/logger.ts 中的 Logger 类：
 * - 不同日志级别的输出控制
 * - 日志写入文件
 * - 清空日志
 * - 对话日志记录
 *
 * 注意：Logger 写入文件系统，测试使用临时目录避免污染真实日志
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Logger, LogLevel } from '../src/utils/logger.js'

// ===================== 测试辅助 =====================

/** 测试用的临时目录 */
const TEST_LOG_DIR = join(tmpdir(), 'lccode-test-logs')
/** 测试用的日志文件路径 */
const TEST_LOG_FILE = join(TEST_LOG_DIR, 'test.log')

/**
 * 确保测试目录存在
 */
function ensureTestDir(): void {
  if (!existsSync(TEST_LOG_DIR)) {
    mkdirSync(TEST_LOG_DIR, { recursive: true })
  }
}

/**
 * 清理测试日志文件
 */
function cleanTestLog(): void {
  if (existsSync(TEST_LOG_FILE)) {
    writeFileSync(TEST_LOG_FILE, '')
  }
}

/**
 * 读取日志文件内容
 */
function readTestLog(): string {
  return readFileSync(TEST_LOG_FILE, 'utf-8')
}

// ===================== 测试用例 =====================

describe('Logger', () => {
  beforeEach(() => {
    ensureTestDir()
    cleanTestLog()
  })

  afterEach(() => {
    // 清理测试文件
    if (existsSync(TEST_LOG_FILE)) {
      rmSync(TEST_LOG_FILE, { force: true })
    }
  })

  // ---------- 日志级别测试 ----------

  describe('日志级别', () => {
    /**
     * LogLevel 枚举值应该正确
     * DEBUG=0, INFO=1, WARN=2, ERROR=3
     */
    it('LogLevel 枚举值应该正确', () => {
      expect(LogLevel.DEBUG).toBe(0)
      expect(LogLevel.INFO).toBe(1)
      expect(LogLevel.WARN).toBe(2)
      expect(LogLevel.ERROR).toBe(3)
    })

    /**
     * 日志级别应该是递增的（用于比较）
     */
    it('日志级别应该是递增的', () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO)
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN)
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR)
    })
  })

  // ---------- 日志写入测试 ----------

  describe('日志写入', () => {
    /**
     * 默认级别是 INFO，应该写入 info 日志
     */
    it('默认级别应该写入 info 日志', () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE })
      logger.info('测试信息')

      const content = readTestLog()
      expect(content).toContain('测试信息')
    })

    /**
     * 默认级别是 INFO，不应该写入 debug 日志
     */
    it('默认级别不应该写入 debug 日志', () => {
      // 先写入空内容确保文件存在
      writeFileSync(TEST_LOG_FILE, '')
      const logger = new Logger({ logFile: TEST_LOG_FILE })
      logger.debug('调试信息')

      const content = readTestLog()
      expect(content).not.toContain('调试信息')
    })

    /**
     * DEBUG 级别应该写入所有级别的日志
     */
    it('DEBUG 级别应该写入所有日志', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })

      logger.debug('调试')
      logger.info('信息')
      logger.warn('警告')
      logger.error('错误')

      const content = readTestLog()
      expect(content).toContain('调试')
      expect(content).toContain('信息')
      expect(content).toContain('警告')
      expect(content).toContain('错误')
    })

    /**
     * WARN 级别只应该写入 WARN 和 ERROR
     */
    it('WARN 级别只应该写入 warn 和 error', () => {
      const logger = new Logger({ level: LogLevel.WARN, logFile: TEST_LOG_FILE })

      logger.debug('调试')
      logger.info('信息')
      logger.warn('警告')
      logger.error('错误')

      const content = readTestLog()
      expect(content).not.toContain('调试')
      expect(content).not.toContain('信息')
      expect(content).toContain('警告')
      expect(content).toContain('错误')
    })

    /**
     * ERROR 级别只应该写入 ERROR
     */
    it('ERROR 级别只应该写入 error', () => {
      const logger = new Logger({ level: LogLevel.ERROR, logFile: TEST_LOG_FILE })

      logger.debug('调试')
      logger.info('信息')
      logger.warn('警告')
      logger.error('错误')

      const content = readTestLog()
      expect(content).not.toContain('调试')
      expect(content).not.toContain('信息')
      expect(content).not.toContain('警告')
      expect(content).toContain('错误')
    })
  })

  // ---------- 附加数据测试 ----------

  describe('附加数据', () => {
    /**
     * 字符串类型的附加数据应该直接写入
     */
    it('应该写入字符串类型的附加数据', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })
      logger.info('主消息', '附加数据')

      const content = readTestLog()
      expect(content).toContain('主消息')
      expect(content).toContain('附加数据')
    })

    /**
     * 对象类型的附加数据应该被 JSON 序列化
     */
    it('应该将对象类型附加数据序列化为 JSON', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })
      logger.info('主消息', { key: 'value', num: 42 })

      const content = readTestLog()
      expect(content).toContain('主消息')
      expect(content).toContain('"key": "value"')
      expect(content).toContain('"num": 42')
    })

    /**
     * 不传附加数据时不应该出错
     */
    it('不传附加数据时不应该出错', () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE })
      expect(() => logger.info('只有主消息')).not.toThrow()
    })
  })

  // ---------- 清空日志测试 ----------

  describe('clear', () => {
    /**
     * clear 应该清空日志文件
     */
    it('应该清空日志文件', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })

      logger.info('一些内容')
      expect(readTestLog()).toContain('一些内容')

      logger.clear()
      expect(readTestLog()).toBe('')
    })
  })

  // ---------- 分隔线测试 ----------

  describe('separator', () => {
    /**
     * separator 应该写入 60 个等号
     */
    it('应该写入分隔线', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })
      logger.separator()

      const content = readTestLog()
      expect(content).toContain('='.repeat(60))
    })
  })

  // ---------- 对话日志测试 ----------

  describe('logConversation', () => {
    /**
     * logConversation 应该记录完整的对话上下文
     * 包含用户查询、助手回答和轮次信息
     */
    it('应该记录完整的对话上下文', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })
      logger.logConversation('用户问题', '助手回答', 1)

      const content = readTestLog()
      // 应该包含轮次信息
      expect(content).toContain('Round 1')
      // 应该包含用户查询
      expect(content).toContain('[User Query]')
      expect(content).toContain('用户问题')
      // 应该包含助手回答
      expect(content).toContain('[Assistant Answer]')
      expect(content).toContain('助手回答')
      // 应该包含分隔线
      expect(content).toContain('='.repeat(60))
    })

    /**
     * 不同轮次应该有不同的编号
     */
    it('不同轮次应该有不同的编号', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, logFile: TEST_LOG_FILE })
      logger.logConversation('问题1', '回答1', 1)
      logger.logConversation('问题2', '回答2', 3)

      const content = readTestLog()
      expect(content).toContain('Round 1')
      expect(content).toContain('Round 3')
    })
  })
})
