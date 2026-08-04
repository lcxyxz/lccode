<!-- hint:noJsonTag -->
Wrap the JSON in <lccode_json>...</lccode_json> tags.

Correct format example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "your thinking",
  "answer": "your answer"
}
</lccode_json>

Note:
1. Must use the opening <lccode_json> and closing </lccode_json> tags
2. JSON goes directly between the tags, no backticks or code fences

<!-- hint:jsonSyntax -->
Invalid JSON format, check:
1. All strings must be wrapped in double quotes
2. Double quotes inside strings must be escaped as \"
3. Backslashes inside strings must be escaped as \\
4. No trailing commas
5. No unescaped newlines

Correct example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "thinking",
  "answer": "first line\\nsecond line"
}
</lccode_json>

Common mistakes:
- Unescaped backtick ` in answer -> write plain text
- Code fence ``` in answer -> write plain text

<!-- hint:missingType -->
The type field is required and must be a string.

Valid values:
- "tool_call" - call a tool
- "final_answer" - return the final answer
- "need_clarification" - ask the user for clarification

Example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "thinking",
  "answer": "answer content"
}
</lccode_json>

<!-- hint:missingRoundAction -->
The round_action field is required and must describe the action you will take this round.

Example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "User wants to know how to run the code, I need to provide the run command",
  "answer": "Run: python test.py"
}
</lccode_json>

<!-- hint:toolCallMissingTool -->
The tool_call type must include the tool field (tool name).

Example:
<lccode_json>
{
  "type": "tool_call",
  "round_action": "need to run ls to list files",
  "tool": "execute_command",
  "params": { "command": "ls -la" }
}
</lccode_json>

<!-- hint:toolCallMissingParams -->
The tool_call type must include the params field (tool arguments).

Example:
<lccode_json>
{
  "type": "tool_call",
  "round_action": "need to write a file",
  "tool": "write_file",
  "params": { 
    "file_path": "test.txt",
    "content": "file content"
  }
}
</lccode_json>

<!-- hint:finalAnswerMissingAnswer -->
The final_answer type must include the answer field (final answer).

Example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "task done",
  "answer": "File created successfully"
}
</lccode_json>

<!-- hint:clarificationMissingQuestion -->
The need_clarification type must include the question field.

Example:
<lccode_json>
{
  "type": "need_clarification",
  "round_action": "user intent is unclear",
  "question": "Which operation do you need?",
  "options": ["view files", "run command"]
}
</lccode_json>

<!-- hint:errorMissingError -->
The error type must include the error field.

Example:
<lccode_json>
{
  "type": "error",
  "round_action": "an error occurred",
  "error": "file not found"
}
</lccode_json>

<!-- hint:unknownType -->
The type field must be one of:
- "tool_call" - call a tool
- "final_answer" - return the final answer
- "need_clarification" - ask the user for clarification
- "error" - report an error

Example:
<lccode_json>
{
  "type": "final_answer",
  "round_action": "thinking",
  "answer": "answer content"
}
</lccode_json>
