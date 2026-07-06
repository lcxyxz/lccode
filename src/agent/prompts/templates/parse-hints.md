<!-- hint:noJsonTag -->
请确保使用 <lccode_json>...</lccode_json> 标签包裹 JSON。

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
2. JSON 内容直接写在标签之间，不要使用反引号或其他代码块标记

<!-- hint:jsonSyntax -->
JSON 格式不正确，请检查：
1. 所有字符串必须用双引号包裹
2. 字符串中的双引号需要转义为 \"
3. 字符串中的反斜杠需要转义为 \\
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
- answer 中包含未转义的反引号 ` -> 直接写文字
- answer 中包含代码块 ``` -> 直接写文字

<!-- hint:missingType -->
必须包含 type 字段，且为字符串类型。

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
</lccode_json>

<!-- hint:missingThought -->
thought 字段是必填的，必须包含你的思考过程。

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "用户想要了解如何运行代码，我需要提供运行命令",
  "answer": "运行方式：python test.py"
}
</lccode_json>

<!-- hint:toolCallMissingTool -->
tool_call 类型必须包含 tool 字段（工具名称）。

示例：
<lccode_json>
{
  "type": "tool_call",
  "thought": "需要执行 ls 命令查看文件",
  "tool": "execute_command",
  "params": { "command": "ls -la" }
}
</lccode_json>

<!-- hint:toolCallMissingParams -->
tool_call 类型必须包含 params 字段（工具参数）。

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
</lccode_json>

<!-- hint:finalAnswerMissingAnswer -->
final_answer 类型必须包含 answer 字段（最终答案）。

示例：
<lccode_json>
{
  "type": "final_answer",
  "thought": "已完成任务",
  "answer": "文件已创建成功"
}
</lccode_json>

<!-- hint:clarificationMissingQuestion -->
need_clarification 类型必须包含 question 字段。

示例：
<lccode_json>
{
  "type": "need_clarification",
  "thought": "用户意图不明确",
  "question": "请问你需要哪种操作？",
  "options": ["查看文件", "执行命令"]
}
</lccode_json>

<!-- hint:errorMissingError -->
error 类型必须包含 error 字段。

示例：
<lccode_json>
{
  "type": "error",
  "thought": "发生了一个错误",
  "error": "文件不存在"
}
</lccode_json>

<!-- hint:unknownType -->
type 字段必须是以下值之一：
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
</lccode_json>
