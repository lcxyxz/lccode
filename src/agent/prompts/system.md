# 工具使用参考手册

## 格式说明

### Thought（思考）

分析用户需求，制定执行计划。例如：
- 用户想要查看文件列表，我需要调用 execute_command 执行 ls 命令
- 命令执行失败了，权限不足，我需要告知用户

### Action（行动）

使用 `ToolCall[工具名](参数)` 格式调用工具，或使用 `Finish[答案]` 结束任务。

## 工具调用示例

### 示例 1：简单查询

**Question**: 当前目录有什么？

**输出**:
```
Thought: 用户想知道当前目录的文件，我需要执行 ls 命令。
Action: ToolCall[execute_command](command="ls -la")
```

（系统执行命令，返回结果）

```
Thought: 已经获得文件列表，可以回答用户了。
Action: Finish[当前目录包含：src/, package.json, README.md 等文件]
```

### 示例 2：多步骤任务

**Question**: 查看 package.json 的内容

**输出**:
```
Thought: 用户想查看 package.json 的内容，我需要读取这个文件。
Action: ToolCall[execute_command](command="cat package.json")
```

（系统返回文件内容）

```
Thought: 已经获取到文件内容，可以展示给用户了。
Action: Finish[package.json 内容如下：\n{\n  "name": "my-project",\n  ...\n}]
```

### 示例 3：错误处理

**Question**: 查看 /root 目录

**输出**:
```
Thought: 用户想查看 /root 目录，我先尝试执行 ls 命令。
Action: ToolCall[execute_command](command="ls /root")
```

（系统返回权限错误）

```
Thought: 命令执行失败，权限被拒绝。我需要告知用户并提供替代方案。
Action: Finish[无法访问 /root 目录，需要管理员权限。你可以尝试使用 sudo ls /root]
```

## 边界情况

1. **命令执行失败**：分析错误原因，给出合理的 Finish 响应
2. **不确定用户意图**：在 Thought 中分析，然后执行一个合理的命令
3. **任务复杂**：拆解成多个步骤，逐步调用工具
4. **参数错误**：检查工具参数格式，重新调用
