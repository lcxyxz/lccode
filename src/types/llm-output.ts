/**
 * LLM 输出类型定义和解析器
 * 所有 LLM 输出都使用统一的 JSON 格式，使用 <lccode_json> 标签包裹
 */

import { PARSE_HINTS } from '../agent/prompts/loader.js'


// ===================== 类型定义 =====================

// 基础接口
interface BaseOutput {
  type: string
  thought: string 
}

// 工具调用
export interface ToolCallOutput extends BaseOutput {
  type: 'tool_call'
  tool: string
  params: Record<string, any>
}

// 最终答案
export interface FinalAnswerOutput extends BaseOutput {
  type: 'final_answer'
  answer: string
}

// 需要澄清
export interface NeedClarificationOutput extends BaseOutput {
  type: 'need_clarification'
  question: string
  options?: string[]
}

// 错误输出
export interface ErrorOutput extends BaseOutput {
  type: 'error'
  error: string
  code?: string
}

// 所有可能的输出类型
export type LLMOutput = 
  | ToolCallOutput 
  | FinalAnswerOutput 
  | NeedClarificationOutput 
  | ErrorOutput

// ===================== 解析结果类型 =====================

export interface ParseSuccess {
  success: true
  output: LLMOutput
}

export interface ParseFailure {
  success: false
  error: string
  hint: string  // 给大模型的修复提示
}

export type ParseResult = ParseSuccess | ParseFailure

// ===================== 类型守卫函数 =====================

export function isToolCallOutput(output: LLMOutput): output is ToolCallOutput {
  return output.type === 'tool_call'
}

export function isFinalAnswerOutput(output: LLMOutput): output is FinalAnswerOutput {
  return output.type === 'final_answer'
}

export function isNeedClarificationOutput(output: LLMOutput): output is NeedClarificationOutput {
  return output.type === 'need_clarification'
}

export function isErrorOutput(output: LLMOutput): output is ErrorOutput {
  return output.type === 'error'
}

// ===================== JSON 提取 =====================

/**
 * 从响应中提取 JSON 字符串
 */
function extractJsonFromResponse(raw: string): string | null {
  // 匹配 <lccode_json>...</lccode_json>
  const match = raw.match(/<lccode_json>\s*([\s\S]*?)\s*<\/lccode_json>/)
  if (match) {
    return match[1]
  }

  return null
}

// ===================== 解析函数 =====================

/**
 * 解析 LLM 原始输出
 * 返回解析结果（成功或失败及错误信息）
 */
export function parseLLMOutput(raw: string): ParseResult {
  // 提取 JSON
  const jsonStr = extractJsonFromResponse(raw)
  
  if (!jsonStr) {
    return {
      success: false,
      error: '无法从响应中提取 JSON',
      hint: PARSE_HINTS.noJsonTag(),
    }
  }

  // 解析 JSON
  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch (error) {
    return {
      success: false,
      error: `JSON 语法错误: ${(error as Error).message}`,
      hint: PARSE_HINTS.jsonSyntax(),
    }
  }

  // 验证 type 字段
  if (!parsed.type || typeof parsed.type !== 'string') {
    return {
      success: false,
      error: '缺少 type 字段或 type 字段类型错误',
      hint: PARSE_HINTS.missingType(),
    }
  }

  // 验证 thought 字段
  if (!parsed.thought || typeof parsed.thought !== 'string') {
    return {
      success: false,
      error: '缺少 thought 字段或 thought 字段为空',
      hint: PARSE_HINTS.missingThought(),
    }
  }

  // 根据 type 验证其他必需字段
  switch (parsed.type) {
    case 'tool_call':
      if (!parsed.tool || typeof parsed.tool !== 'string') {
        return {
          success: false,
          error: 'tool_call 类型缺少 tool 字段',
          hint: PARSE_HINTS.toolCallMissingTool(),
        }
      }
      if (!parsed.params || typeof parsed.params !== 'object') {
        return {
          success: false,
          error: 'tool_call 类型缺少 params 字段',
          hint: PARSE_HINTS.toolCallMissingParams(),
        }
      }
      return {
        success: true,
        output: {
          type: 'tool_call',
          thought: parsed.thought,
          tool: parsed.tool,
          params: parsed.params
        }
      }

    case 'final_answer':
      if (!parsed.answer || typeof parsed.answer !== 'string') {
        return {
          success: false,
          error: 'final_answer 类型缺少 answer 字段',
          hint: PARSE_HINTS.finalAnswerMissingAnswer(),
        }
      }
      return {
        success: true,
        output: {
          type: 'final_answer',
          thought: parsed.thought,
          answer: parsed.answer
        }
      }

    case 'need_clarification':
      if (!parsed.question || typeof parsed.question !== 'string') {
        return {
          success: false,
          error: 'need_clarification 类型缺少 question 字段',
          hint: PARSE_HINTS.clarificationMissingQuestion(),
        }
      }
      return {
        success: true,
        output: {
          type: 'need_clarification',
          thought: parsed.thought,
          question: parsed.question,
          options: parsed.options
        }
      }

    case 'error':
      if (!parsed.error || typeof parsed.error !== 'string') {
        return {
          success: false,
          error: 'error 类型缺少 error 字段',
          hint: PARSE_HINTS.errorMissingError(),
        }
      }
      return {
        success: true,
        output: {
          type: 'error',
          thought: parsed.thought,
          error: parsed.error,
          code: parsed.code
        }
      }

    default:
      return {
        success: false,
        error: `未知的 type 类型: "${parsed.type}"`,
        hint: PARSE_HINTS.unknownType(),
      }
  }
}


