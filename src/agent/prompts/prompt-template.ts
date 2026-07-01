/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表、对话历史和用户问题
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { ToolRegistry } from '../tools/tool-registry.js'
import type { ChatMessage } from '../../services/llm.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface PromptContext {
  history: ChatMessage[]
}

/**
 * 加载参考手册（可选，注入到提示词中帮助 LLM 理解格式）
 */
export function loadReferenceManual(): string {
  try {
    const manualPath = join(__dirname, './system.md')
    return readFileSync(manualPath, 'utf-8').trim()
  } catch {
    return ''
  }
}

/**
 * 格式化对话历史
 */
function formatHistory(history: ChatMessage[]): string {
  if (history.length === 0) return '(无历史对话)'

  return history
    .map(msg => {
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`
      if (msg.role === 'user' && msg.content.startsWith('[ToolExeInfo] ')) {
        return `ToolExeInfo: ${msg.content.slice(14)}`
      }
      if (msg.role === 'user') return `User: ${msg.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
  ctx: PromptContext,
): string {
  const toolDescriptions = registry.formatToolDescriptions()
  const history = formatHistory(ctx.history)
  const referenceManual = loadReferenceManual()

  return `你是一个由桂电找不到工作的一名学生创造的有能力调用外部工具的智能助手。

## 可用工具

${toolDescriptions}

## 输出格式（严格遵守）

你的每次回应必须且只能包含以下格式：

Thought: <你的思考过程，用于分析问题、拆解任务、规划下一步>
Action: <你决定采取的行动>

### Action 格式

Action 必须是以下两种之一：

**1. 调用工具：**

ToolCall[工具名](参数名="参数值")

示例：
- ToolCall[execute_command](command="ls -la")
- ToolCall[execute_command](command="cat package.json")
- ToolCall[read_file](file_path="src/app.tsx")
- ToolCall[read_file](file_path="src/app.tsx", start_line="10", end_line="30")
- ToolCall[write_file](file_path="src/utils.ts", content="export function add(a: number, b: number) { return a + b }")
- ToolCall[edit_file](file_path="src/app.tsx", old_text="const x = 1", new_text="const x = 2")
- ToolCall[edit_file](file_path="src/app.tsx", start_line="5", end_line="8", new_text="新内容")
- ToolCall[delete_file](file_path="src/old-file.ts")
- ToolCall[delete_directory](dir_path="src/old-folder")

**2. 结束任务：**

Finish[最终答案]

## 重要规则

1. 每次只能调用一个工具
2. 必须先输出 Thought，再输出 Action
3. 当工具执行成功并返回结果后，你应该：
   - 分析结果是否已足够回答用户
   - 如果足够，使用 Finish[...] 输出最终答案
   - 如果不够，继续调用其他工具
4. 不要重复执行相同的命令，如果已经获取到结果就直接 Finish
5. 使用中文回答
6. 如果工具输出被截断（提示"输出被截断"），只总结你实际看到的内容，不要推测或编造被截断的部分

## execute_command 严格限制

execute_command 每次只能执行一条简单的、单一的 shell 命令。以下行为**绝对禁止**：

- 禁止使用 &&、||、;、|（管道）连接多条命令
- 禁止使用换行符或反引号在一条命令中执行多个操作
- 禁止使用 { ... } 或 ( ... ) 组合命令

**错误示例（禁止）：**
- echo '=== 系统运行时间 ===' && uptime && echo '=== 内存使用 ===' && free -h
- cat file1.txt && cat file2.txt
- ls -la | grep ".ts"
- echo "hello" ; echo "world"

**正确做法：**
将任务拆分为多次独立调用，每次只执行一条简单命令。例如用户要求查看系统信息时，应分别调用：
- 第一次：ToolCall[execute_command](command="uptime")
- 第二次：ToolCall[execute_command](command="free -h")
- 第三次：ToolCall[execute_command](command="df -h")

## 工具使用规范

- **execute_command** 是只读工具，仅用于探索文件系统、查看文件内容、搜索代码、检查 Git 状态等。禁止通过它执行任何修改操作（如 mkdir、touch、cp、mv、rm、echo >、sed -i 等）。
- **read_file / write_file / edit_file** 是文件操作工具，所有文件的读取、创建、修改都必须通过这三个工具完成。
- 不要尝试用 execute_command 绕过文件操作限制。

${referenceManual ? `\n## 参考手册\n\n${referenceManual}\n` : ''}
## 对话历史

${history}

根据对话历史中的最新消息，判断当前状态并决定下一步行动。`
}
