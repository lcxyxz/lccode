/**
 * LLM 输出解析器测试
 *
 * 测试 src/types/llm-output.ts 中的所有解析逻辑：
 * - parseLLMOutput: 从 LLM 原始响应中提取并验证 JSON
 * - 类型守卫函数: isToolCallOutput, isFinalAnswerOutput 等
 *
 * LLM 输出格式要求：
 *   <lccode_json>
 *   { "type": "...", "thought": "...", ... }
 *   </lccode_json>
 */
import { describe, it, expect } from 'vitest'
import {
  parseLLMOutput,
  isToolCallOutput,
  isFinalAnswerOutput,
  isNeedClarificationOutput,
  isErrorOutput,
} from '../src/types/llm-output.js'

// ===================== parseLLMOutput 解析测试 =====================

describe('parseLLMOutput', () => {

  // ---------- 成功解析场景 ----------

  describe('成功解析各种 type 类型', () => {

    /**
     * final_answer 类型：
     * LLM 给出最终答案时使用，必须包含 answer 字段
     */
    it('应该正确解析 final_answer 类型', () => {
      const raw = `<lccode_json>
{
  "type": "final_answer",
  "thought": "用户在问天气",
  "answer": "今天天气晴朗，温度 25°C"
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      // 解析应该成功
      expect(result.success).toBe(true)

      // 类型守卫应该正确识别
      if (result.success) {
        expect(isFinalAnswerOutput(result.output)).toBe(true)
        expect(result.output.type).toBe('final_answer')
        expect(result.output.thought).toBe('用户在问天气')
        expect(result.output.answer).toBe('今天天气晴朗，温度 25°C')
      }
    })

    /**
     * tool_call 类型：
     * LLM 决定调用工具时使用，必须包含 tool 和 params 字段
     */
    it('应该正确解析 tool_call 类型', () => {
      const raw = `<lccode_json>
{
  "type": "tool_call",
  "thought": "用户想查看文件列表",
  "tool": "execute_command",
  "params": {
    "command": "ls -la"
  }
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(isToolCallOutput(result.output)).toBe(true)
        expect(result.output.type).toBe('tool_call')
        expect(result.output.tool).toBe('execute_command')
        expect(result.output.params).toEqual({ command: 'ls -la' })
      }
    })

    /**
     * need_clarification 类型：
     * LLM 需要用户进一步澄清时使用，必须包含 question 字段，options 可选
     */
    it('应该正确解析 need_clarification 类型（带 options）', () => {
      const raw = `<lccode_json>
{
  "type": "need_clarification",
  "thought": "用户的请求比较模糊",
  "question": "你想执行什么操作？",
  "options": ["查看文件", "编辑文件", "执行命令"]
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(isNeedClarificationOutput(result.output)).toBe(true)
        expect(result.output.type).toBe('need_clarification')
        expect(result.output.question).toBe('你想执行什么操作？')
        expect(result.output.options).toEqual(['查看文件', '编辑文件', '执行命令'])
      }
    })

    /**
     * need_clarification 不带 options 也应该是合法的
     */
    it('应该正确解析 need_clarification 类型（不带 options）', () => {
      const raw = `<lccode_json>
{
  "type": "need_clarification",
  "thought": "需要确认",
  "question": "请具体说明"
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.type).toBe('need_clarification')
        expect((result.output as any).options).toBeUndefined()
      }
    })

    /**
     * error 类型：
     * LLM 报告错误时使用，必须包含 error 字段，code 可选
     */
    it('应该正确解析 error 类型（带 code）', () => {
      const raw = `<lccode_json>
{
  "type": "error",
  "thought": "文件不存在",
  "error": "文件 /tmp/test.txt 不存在",
  "code": "FILE_NOT_FOUND"
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(isErrorOutput(result.output)).toBe(true)
        expect(result.output.type).toBe('error')
        expect(result.output.error).toBe('文件 /tmp/test.txt 不存在')
        expect(result.output.code).toBe('FILE_NOT_FOUND')
      }
    })

    it('应该正确解析 error 类型（不带 code）', () => {
      const raw = `<lccode_json>
{
  "type": "error",
  "thought": "发生未知错误",
  "error": "something went wrong"
}
</lccode_json>`

      const result = parseLLMOutput(raw)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.type).toBe('error')
        expect((result.output as any).code).toBeUndefined()
      }
    })
  })

  // ---------- JSON 标签提取测试 ----------

  describe('JSON 标签提取', () => {

    /**
     * 验证即使 JSON 前后有额外文本，也能正确提取
     */
    it('应该从包含额外文本的响应中提取 JSON', () => {
      const raw = `这是一些前缀文本
<lccode_json>
{
  "type": "final_answer",
  "thought": "测试",
  "answer": "OK"
}
</lccode_json>
这是后缀文本`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(true)
    })

    /**
     * JSON 标签内允许前后有空白字符
     */
    it('应该处理标签内的多余空白', () => {
      const raw = `<lccode_json>

{
  "type": "final_answer",
  "thought": "test",
  "answer": "ok"
}

</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(true)
    })
  })

  // ---------- 解析失败场景 ----------

  describe('解析失败情况', () => {

    /**
     * 没有 <lccode_json> 标签时，无法提取 JSON
     */
    it('应该在缺少 JSON 标签时返回失败', () => {
      const raw = '这是一段普通的文本，没有 JSON 标签'
      const result = parseLLMOutput(raw)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('无法从响应中提取 JSON')
        // hint 应该是给 LLM 的修复提示
        expect(result.hint).toBeTruthy()
      }
    })

    /**
     * JSON 标签内不是合法 JSON 时
     */
    it('应该在 JSON 语法错误时返回失败', () => {
      const raw = `<lccode_json>
{ "type": "final_answer", "answer": "ok" // 这是注释，不是合法 JSON }
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('JSON 语法错误')
      }
    })

    /**
     * JSON 合法但缺少 type 字段
     */
    it('应该在缺少 type 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "thought": "test",
  "answer": "ok"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('type')
      }
    })

    /**
     * JSON 合法但 type 不是字符串
     */
    it('应该在 type 不是字符串时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": 123,
  "thought": "test"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
    })

    /**
     * JSON 合法但缺少 thought 字段
     */
    it('应该在缺少 thought 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "final_answer",
  "answer": "ok"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('thought')
      }
    })

    /**
     * tool_call 类型缺少 tool 字段
     */
    it('应该在 tool_call 缺少 tool 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "tool_call",
  "thought": "test",
  "params": { "command": "ls" }
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('tool')
      }
    })

    /**
     * tool_call 类型缺少 params 字段
     */
    it('应该在 tool_call 缺少 params 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "tool_call",
  "thought": "test",
  "tool": "execute_command"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('params')
      }
    })

    /**
     * tool_call 的 params 不是对象
     */
    it('应该在 tool_call 的 params 不是对象时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "tool_call",
  "thought": "test",
  "tool": "execute_command",
  "params": "not an object"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
    })

    /**
     * final_answer 缺少 answer 字段
     */
    it('应该在 final_answer 缺少 answer 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "final_answer",
  "thought": "test"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('answer')
      }
    })

    /**
     * need_clarification 缺少 question 字段
     */
    it('应该在 need_clarification 缺少 question 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "need_clarification",
  "thought": "test"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('question')
      }
    })

    /**
     * error 类型缺少 error 字段
     */
    it('应该在 error 类型缺少 error 字段时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "error",
  "thought": "test"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('error')
      }
    })

    /**
     * 未知的 type 类型
     */
    it('应该在未知 type 时返回失败', () => {
      const raw = `<lccode_json>
{
  "type": "unknown_type",
  "thought": "test"
}
</lccode_json>`

      const result = parseLLMOutput(raw)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('未知')
        expect(result.error).toContain('unknown_type')
      }
    })
  })

  // ---------- 类型守卫函数测试 ----------

  describe('类型守卫函数', () => {
    /**
     * 每个类型守卫函数应该只对匹配的 type 返回 true
     */
    it('isToolCallOutput 应该只对 tool_call 返回 true', () => {
      expect(isToolCallOutput({ type: 'tool_call', thought: '', tool: '', params: {} })).toBe(true)
      expect(isToolCallOutput({ type: 'final_answer', thought: '', answer: '' })).toBe(false)
    })

    it('isFinalAnswerOutput 应该只对 final_answer 返回 true', () => {
      expect(isFinalAnswerOutput({ type: 'final_answer', thought: '', answer: '' })).toBe(true)
      expect(isFinalAnswerOutput({ type: 'tool_call', thought: '', tool: '', params: {} })).toBe(false)
    })

    it('isNeedClarificationOutput 应该只对 need_clarification 返回 true', () => {
      expect(isNeedClarificationOutput({ type: 'need_clarification', thought: '', question: '' })).toBe(true)
      expect(isNeedClarificationOutput({ type: 'error', thought: '', error: '' })).toBe(false)
    })

    it('isErrorOutput 应该只对 error 返回 true', () => {
      expect(isErrorOutput({ type: 'error', thought: '', error: '' })).toBe(true)
      expect(isErrorOutput({ type: 'final_answer', thought: '', answer: '' })).toBe(false)
    })
  })
})
