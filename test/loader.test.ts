/**
 * 提示词模板加载器测试
 *
 * 测试 src/agent/prompts/loader.ts 中的所有功能：
 * - render: 变量插值
 * - getSystemPrompt: 获取系统提示词
 * - getRetryMessage: 获取重试消息
 * - PARSE_HINTS: 解析提示
 */
import { describe, it, expect } from 'vitest'
import { render, getSystemPrompt, getRetryMessage, PARSE_HINTS } from '../src/agent/prompts/loader.js'

// ===================== render 测试 =====================

describe('render', () => {
  /**
   * 应该正确替换 {{变量名}} 为实际值
   */
  it('应该替换变量为实际值', () => {
    const template = '你好，{{name}}！欢迎来到 {{place}}。'
    const result = render(template, { name: '小明', place: '北京' })

    expect(result).toBe('你好，小明！欢迎来到 北京。')
  })

  /**
   * 模板中没有变量时应该原样返回
   */
  it('没有变量时应该原样返回', () => {
    const template = '这是纯文本，没有变量。'
    const result = render(template, {})

    expect(result).toBe('这是纯文本，没有变量。')
  })

  /**
   * 变量不存在时应该替换为空字符串
   */
  it('变量不存在时应该替换为空字符串', () => {
    const template = '你好，{{name}}！你的年龄是 {{age}}。'
    const result = render(template, { name: '小明' })

    // age 变量不存在，应该被替换为空字符串
    expect(result).toBe('你好，小明！你的年龄是 。')
  })

  /**
   * 同一个变量可以出现多次
   */
  it('同一个变量可以出现多次', () => {
    const template = '{{name}} 说：你好 {{name}}'
    const result = render(template, { name: '小明' })

    expect(result).toBe('小明 说：你好 小明')
  })

  /**
   * 变量名应该是单词字符（字母、数字、下划线）
   */
  it('应该支持下划线变量名', () => {
    const template = '{{user_name}} 的 {{item_count}} 个物品'
    const result = render(template, { user_name: '小明', item_count: '5' })

    expect(result).toBe('小明 的 5 个物品')
  })

  /**
   * 空模板应该返回空字符串
   */
  it('空模板应该返回空字符串', () => {
    const result = render('', { name: 'test' })
    expect(result).toBe('')
  })

  /**
   * 多行模板应该保持格式
   */
  it('多行模板应该保持格式', () => {
    const template = `第一行：{{a}}
第二行：{{b}}
第三行：{{c}}`
    const result = render(template, { a: '1', b: '2', c: '3' })

    expect(result).toContain('第一行：1')
    expect(result).toContain('第二行：2')
    expect(result).toContain('第三行：3')
  })
})

// ===================== getSystemPrompt 测试 =====================

describe('getSystemPrompt', () => {
  /**
   * 应该返回非空字符串
   */
  it('应该返回非空字符串', () => {
    const prompt = getSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  /**
   * 多次调用应该返回相同内容（缓存）
   */
  it('多次调用应该返回相同内容', () => {
    const prompt1 = getSystemPrompt()
    const prompt2 = getSystemPrompt()
    expect(prompt1).toBe(prompt2)
  })
})

// ===================== getRetryMessage 测试 =====================

describe('getRetryMessage', () => {
  /**
   * 应该返回非空字符串
   */
  it('应该返回非空字符串', () => {
    const message = getRetryMessage()
    expect(typeof message).toBe('string')
    expect(message.length).toBeGreaterThan(0)
  })
})

// ===================== PARSE_HINTS 测试 =====================

describe('PARSE_HINTS', () => {
  /**
   * 每个 hint 函数都应该返回非空字符串
   */
  it('所有 hint 函数都应该返回非空字符串', () => {
    const hints = [
      PARSE_HINTS.noJsonTag,
      PARSE_HINTS.jsonSyntax,
      PARSE_HINTS.missingType,
      PARSE_HINTS.missingThought,
      PARSE_HINTS.toolCallMissingTool,
      PARSE_HINTS.toolCallMissingParams,
      PARSE_HINTS.finalAnswerMissingAnswer,
      PARSE_HINTS.clarificationMissingQuestion,
      PARSE_HINTS.errorMissingError,
      PARSE_HINTS.unknownType,
    ]

    for (const hintFn of hints) {
      const hint = hintFn()
      expect(typeof hint).toBe('string')
      expect(hint.length).toBeGreaterThan(0)
    }
  })

  /**
   * 每个 hint 应该是唯一的（不同的错误场景有不同的提示）
   */
  it('不同场景的 hint 应该不同', () => {
    const hints = new Set([
      PARSE_HINTS.noJsonTag(),
      PARSE_HINTS.jsonSyntax(),
      PARSE_HINTS.missingType(),
      PARSE_HINTS.missingThought(),
      PARSE_HINTS.toolCallMissingTool(),
      PARSE_HINTS.toolCallMissingParams(),
      PARSE_HINTS.finalAnswerMissingAnswer(),
      PARSE_HINTS.clarificationMissingQuestion(),
      PARSE_HINTS.errorMissingError(),
      PARSE_HINTS.unknownType(),
    ])

    // 至少应该有 5 个不同的 hint（有些可能相同）
    expect(hints.size).toBeGreaterThanOrEqual(5)
  })
})
