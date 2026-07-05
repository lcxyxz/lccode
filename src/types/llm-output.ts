/**
 * LLM 输出类型定义和解析器
 * 所有 LLM 输出都使用统一的 JSON 格式，使用 <lccode_json> 标签包裹
 */


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
      hint: `请确保使用 <lccode_json>...</lccode_json> 标签包裹 JSON。

正确格式示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "你的思考过程",
  "answer": "你的答案内容"
}
</lccode_json>

注意：
1. 必须使用 <lccode_json> 开始标签和 </lccode_json> 结束标签
2. JSON 内容直接写在标签之间，不要使用反引号或其他代码块标记`
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
      hint: `JSON 格式不正确，请检查：
1. 所有字符串必须用双引号包裹
2. 字符串中的双引号需要转义为 \\\"
3. 字符串中的反斜杠需要转义为 \\\\
4. 确保没有尾随逗号
5. 确保没有未转义的换行符

正确示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "思考过程",
  "answer": "第一行内容\\n第二行内容"
}
</lccode_json>

常见错误：
- answer 中包含未转义的反引号 \` -> 直接写文字
- answer 中包含代码块 \`\`\` -> 直接写文字`
    }
  }

  // 验证 type 字段
  if (!parsed.type || typeof parsed.type !== 'string') {
    return {
      success: false,
      error: '缺少 type 字段或 type 字段类型错误',
      hint: `必须包含 type 字段，且为字符串类型。

可选值：
- "tool_call" - 调用工具
- "final_answer" - 返回最终答案
- "need_clarification" - 需要用户澄清

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "思考过程",
  "answer": "答案内容"
}
</lccode_json>`
    }
  }

  // 验证 thought 字段
  if (!parsed.thought || typeof parsed.thought !== 'string') {
    return {
      success: false,
      error: '缺少 thought 字段或 thought 字段为空',
      hint: `thought 字段是必填的，必须包含你的思考过程。

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "用户想要了解如何运行代码，我需要提供运行命令",
  "answer": "运行方式：python test.py"
}
</lccode_json>`
    }
  }

  // 根据 type 验证其他必需字段
  switch (parsed.type) {
    case 'tool_call':
      if (!parsed.tool || typeof parsed.tool !== 'string') {
        return {
          success: false,
          error: 'tool_call 类型缺少 tool 字段',
          hint: `tool_call 类型必须包含 tool 字段（工具名称）。

示例：
<lccode_json>
{
  "type": "tool_call",
  "thought": "需要执行 ls 命令查看文件",
  "tool": "execute_command",
  "params": { "command": "ls -la" }
}
</lccode_json>`
        }
      }
      if (!parsed.params || typeof parsed.params !== 'object') {
        return {
          success: false,
          error: 'tool_call 类型缺少 params 字段',
          hint: `tool_call 类型必须包含 params 字段（工具参数）。

示例：
<lccode_json>
{
  "type": "tool_call",
  "thought": "需要写入文件",
  "tool": "write_file",
  "params": { 
    "file_path": "test.txt",
    "content": "文件内容"
  }
}
</lccode_json>`
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
          hint: `final_answer 类型必须包含 answer 字段（最终答案）。

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "已完成任务",
  "answer": "文件已创建成功"
}
</lccode_json>`
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
          hint: `need_clarification 类型必须包含 question 字段。

示例：
<lccode_json>
{
  "type": "need_clarification",
  "thought": "用户意图不明确",
  "question": "请问你需要哪种操作？",
  "options": ["查看文件", "执行命令"]
}
</lccode_json>`
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
          hint: `error 类型必须包含 error 字段。

示例：
<lccode_json>
{
  "type": "error",
  "thought": "发生了一个错误",
  "error": "文件不存在"
}
</lccode_json>`
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
        hint: `type 字段必须是以下值之一：
- "tool_call" - 调用工具
- "final_answer" - 返回最终答案
- "need_clarification" - 需要用户澄清
- "error" - 报告错误

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "思考过程",
  "answer": "答案内容"
}
</lccode_json>`
      }
  }
}


