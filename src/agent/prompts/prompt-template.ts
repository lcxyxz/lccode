/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表、对话历史和用户问题
 */

import type { ToolRegistry } from '../tools/tool-registry.js'
import type { ChatMessage } from '../../services/types.js'


export interface PromptContext {
  history: ChatMessage[]
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
 * 检查对话历史中是否需要注入 execute_command 限制
 */
function needsCommandRestrictions(history: ChatMessage[]): boolean {
  const recentMessages = history.slice(-6)
  const commandKeywords = ['查看', '执行', '运行', '检查', '搜索', '查找', '列出', '显示']
  return recentMessages.some(msg =>
    msg.role === 'user' && commandKeywords.some(kw => msg.content.includes(kw))
  )
}

// ===================== 静态部分缓存 =====================

let staticPromptPrefix: string | null = null
let staticPromptSuffix: string | null = null
let cachedRegistryVersion = -1

/**
 * 构建静态提示词前缀（工具描述 + 输出格式）
 * 只在工具注册表变化时重新构建
 */
function buildStaticPrefix(registry: ToolRegistry): string {
  // 检查工具注册表版本是否变化，变化则清除缓存
  if (registry.version !== cachedRegistryVersion) {
    staticPromptPrefix = null
    cachedRegistryVersion = registry.version
  }

  if (staticPromptPrefix === null) {
    const toolDescriptions = registry.formatToolDescriptions()
    staticPromptPrefix = `你是智能助手，可调用工具完成任务。

## 可用工具

${toolDescriptions}

## 输出格式（必须严格遵守）

每次回应必须且只能输出一个 JSON 对象，使用 <lccode_json> 标签包裹：

<lccode_json>
{
  "type": "<类型>",
  ...其他字段
}
</lccode_json>

### 支持的类型

#### 1. 工具调用 (tool_call)
调用工具时使用：

<lccode_json>
{
  "type": "tool_call",
  "thought": "你的思考过程",
  "tool": "工具名",
  "params": {
    "参数名": "参数值"
  }
}
</lccode_json>

**示例：**
<lccode_json>
{
  "type": "tool_call",
  "thought": "用户想查看当前目录的文件，我需要执行 ls 命令",
  "tool": "execute_command",
  "params": {
    "command": "ls -la"
  }
}
</lccode_json>

#### 2. 最终答案 (final_answer)
任务完成，返回最终答案时使用：

<lccode_json>
{
  "type": "final_answer",
  "thought": "你的思考过程",
  "answer": "最终答案内容"
}
</lccode_json>

**示例：**
<lccode_json>
{
  "type": "final_answer",
  "thought": "已经获取到文件列表，可以直接回答用户",
  "answer": "当前目录包含：src/, package.json, README.md 等文件"
}
</lccode_json>

#### 3. 需要澄清 (need_clarification)
当用户意图不明确，需要进一步确认时使用：

<lccode_json>
{
  "type": "need_clarification",
  "thought": "用户的请求比较模糊，需要确认具体需求",
  "question": "请确认你需要哪种操作？",
  "options": ["选项1", "选项2"]
}
</lccode_json>

## 文件写入示例

<lccode_json>
{
  "type": "tool_call",
  "thought": "用户需要创建 Python 文件",
  "tool": "write_file",
  "params": {
    "file_path": "example.py",
    "content": "#!/usr/bin/env python3\\nprint('Hello World')"
  }
}
</lccode_json>

**注意：**
- content 字段中的换行符使用 \\n 表示
- 双引号使用 \\" 转义
- 反斜杠使用 \\\\ 转义

## 重要规则

1. 每次回应**必须且只能**输出一个 JSON 对象
2. 必须使用 <lccode_json>...</lccode_json> 标签包裹
3. \`type\` 字段是必填的，决定了 JSON 的结构
4. **\`thought\` 字段是必填的**，必须记录你的思考过程，不能为空
5. 对于文件写入，content 字段必须包含完整文件内容
6. 确保 JSON 格式正确，避免语法错误
7. 不要重复执行相同命令
8. 使用中文回答

## 上下文搜集策略（优先使用 grep）

**回答问题前，优先用 grep 搜集上下文！**

使用 \`execute_command\` 工具执行 grep 命令来搜索代码库，这是获取上下文的首选方式。

### 搜索示例

**搜索函数定义或调用：**
\`\`\`json
{
  "type": "tool_call",
  "thought": "用户想了解某个函数，先搜索它的定义和调用位置",
  "tool": "execute_command",
  "params": {
    "command": "grep -rn 'functionName' --include='*.ts'"
  }
}
\`\`\`

**搜索变量使用：**
\`\`\`json
{
  "type": "tool_call",
  "thought": "搜索变量名在哪些地方被使用",
  "tool": "execute_command",
  "params": {
    "command": "grep -rn 'variableName' --include='*.ts' src/"
  }
}
\`\`\`

**搜索错误信息：**
\`\`\`json
{
  "type": "tool_call",
  "thought": "查找这个错误信息的来源",
  "tool": "execute_command",
  "params": {
    "command": "grep -rn 'Error message' --include='*.{ts,log}'"
  }
}
\`\`\`

**搜索类定义：**
\`\`\`json
{
  "type": "tool_call",
  "thought": "查找类的定义和实现",
  "tool": "execute_command",
  "params": {
    "command": "grep -rn 'class ClassName' --include='*.ts'"
  }
}
\`\`\`

### grep 使用策略

1. **回答代码问题前**：先用 \`grep -rn '关键词'\` 搜索相关代码
2. **指定文件类型**：用 \`--include='*.ts'\` 限定搜索范围，提高效率
3. **限定目录**：用 \`grep -rn 'pattern' src/\` 在特定目录下搜索
4. **忽略大小写**：用 \`grep -rni 'pattern'\` 进行不区分大小写的搜索
5. **多次搜索**：一次 grep 结果不够时，继续用不同关键词搜索，直到获得充分上下文

`
  }
  return staticPromptPrefix
}

/**
 * 构建静态提示词后缀（固定结尾）
 */
function buildStaticSuffix(): string {
  if (staticPromptSuffix === null) {
    staticPromptSuffix = `
根据对话历史中的最新消息，判断当前状态并决定下一步行动，输出对应的 JSON。`
  }
  return staticPromptSuffix
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
  ctx: PromptContext,
): string {
  const prefix = buildStaticPrefix(registry)
  const suffix = buildStaticSuffix()
  const history = formatHistory(ctx.history)
  const needsCommandLimit = needsCommandRestrictions(ctx.history)

  const commandLimit = needsCommandLimit ? `
## execute_command 限制
每次只执行一条命令，禁止 && || ; | 连接多条命令` : ''

  return `${prefix}${commandLimit}

## 对话历史

${history}${suffix}`
}
