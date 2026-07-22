# lccode

一个基于 Ink 构建的极简终端 AI 编程助手，支持 DeepSeek 和 Mimo 两家 AI 服务提供商。

**版本**: 0.1.0 | **协议**: MIT | **Node.js**: >= 18

## 功能特性

- **多厂商 AI 对话**：支持 DeepSeek 和 Mimo 两家服务商，灵活切换模型
- **MCP 协议**：支持 Model Context Protocol，可连接外部工具服务器
- **命令执行**：AI 可以生成并执行终端命令，实时反馈结果
- **交互式界面**：基于 Ink 的终端 UI，支持文件和命令建议
- **Diff 预览**：文件修改后展示带行号和语法高亮的差异对比
- **计划任务**：支持 plan_task 子 Agent，自动规划和执行复杂任务
- **Skill 技能系统**：支持自定义 Markdown 技能文件，扩展 AI 能力
- **沙箱权限**：细粒度的权限控制，支持 strict/relaxed/permissive 三种预设
- **安全规则**：智能识别危险命令并提示用户确认，内置白名单安全命令
- **工具优先级**：优先使用专用工具，确保操作安全高效
- **搜索策略**：跨平台内容搜索和文件名搜索，替代 grep/find 命令

## 效果展示

### 创建文件

AI 创建文件时，自动展示带行号和语法高亮的预览：

![创建文件](imgs/image1.png)

### 编辑文件

AI 编辑文件后，实时展示修改差异对比：

![编辑文件](imgs/image2.png)

### 状态栏

底部状态栏显示模型名称、Token 用量和当前状态：

![状态栏](imgs/image3.png)

### MCP 工具调用

稳定调用 MCP 工具（如 Word 文档操作）：

![MCP工具1](imgs/image4.png)

![MCP工具2](imgs/image5.png)

### 代码安全分析

![安全分析1](imgs/image6.png)

![安全分析2](imgs/image7.png)

## 内置工具

### 文件操作

| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件内容，支持行范围过滤 |
| `write_file` | 创建新文件或覆盖已有文件 |
| `edit_file` | 精确编辑文件：支持按行范围替换或按字符串查找替换 |
| `delete_file` | 删除指定文件 |
| `delete_directory` | 递归删除文件夹及其所有内容 |
| `add_dir` | 创建文件夹（支持递归创建父目录） |

### 搜索工具

| 工具 | 说明 |
|------|------|
| `search` (type="content") | 跨平台内容搜索，支持正则表达式（替代 grep） |
| `search` (type="files") | 跨平台文件名搜索，支持 glob 通配符（替代 find） |

### 执行与权限

| 工具 | 说明 |
|------|------|
| `execute_command` | 执行终端命令，内置安全检查 |
| `sandbox` | 管理沙箱权限：查看、启用/禁用权限，使用预设配置 |

### 子 Agent 与技能

| 工具 | 说明 |
|------|------|
| `plan_task` | 启动计划任务子 Agent，自动拆解和执行复杂任务 |
| `skill__<name>` | 调用自定义技能（从 `.lccode/skills/` 加载） |

### 工具优先级

AI 会优先使用专用工具完成任务，确保操作安全高效：

| 任务 | 优先使用 | 而非 |
|------|----------|------|
| 搜索文件内容 | `search` (type="content") | `execute_command` + grep |
| 搜索文件名 | `search` (type="files") | `execute_command` + find/dir |
| 创建文件夹 | `add_dir` | `execute_command` + mkdir |
| 读取文件 | `read_file` | `execute_command` + cat |
| 写入文件 | `write_file` | `execute_command` + echo/tee |
| 编辑文件 | `edit_file` | `execute_command` + sed |

## 安全机制

### 命令安全检查

使用 `execute_command` 前，AI 会自动判断命令是否危险：

**危险模式**（需用户确认）：
- `rm -rf` 递归删除
- `sudo rm`
- `mkfs` 格式化磁盘
- `dd if=` 底层写入
- `chmod 777` 全开权限
- 文件重定向覆盖
- 管道给 shell 执行

**白名单安全命令**（可直接执行）：
`ls`, `pwd`, `cat`, `grep`, `find`, `head`, `tail`, `wc`, `echo`, `ps`, `df`, `du`, `free`, `uname`, `whoami`, `date`, `git`, `npm`, `npx`, `yarn`, `pnpm` 等

### 沙箱权限系统

通过 `sandbox` 工具管理 Agent 的权限边界：

| 权限 | 说明 |
|------|------|
| `network` | 网络访问 |
| `env_vars` | 环境变量读取 |
| `process` | 进程管理 |
| `system_dirs` | 系统目录访问 |
| `user_dirs` | 用户目录访问 |
| `parent_traversal` | 父目录遍历 |
| `absolute_paths` | 绝对路径访问 |

**预设模式**：
- `strict` - 严格模式：禁用所有敏感权限
- `relaxed` - 宽松模式：允许网络访问和环境变量
- `permissive` - 开放模式：允许除绝对路径外的所有权限

## 快速开始

### 系统要求

- **Node.js**: >= 18
- **操作系统**: macOS / Linux / Windows

### 安装（推荐）

通过 npm 全局安装：

```bash
npm install -g @lcxyxz/lccode
```

安装完成后，在任意目录下直接运行：

```bash
lccode
```

### 从源码安装

```bash
git clone https://github.com/lcxyxz/lccode.git
cd lccode
npm install
npm run build
npm link
```

之后在任意目录下直接运行：

```bash
lccode
```

### 配置

在用户家目录下创建配置文件 `~/.lccode/config.json`：

```bash
mkdir -p ~/.lccode
cat > ~/.lccode/config.json << 'EOF'
{
  "provider": "deepseek",
  "apiKey": "your-api-key",
  "model": "deepseek-v4-flash"
}
EOF
```

> 首次运行时，如果未检测到配置文件，会自动进入交互式配置向导。

#### 配置优先级

支持两级配置，项目级配置会覆盖用户级配置：
- **用户级配置**：`~/.lccode/config.json`（全局生效）
- **项目级配置**：`.lccode/config.json`（仅当前项目生效）

#### 支持的 AI 服务提供商

| Provider | 说明 | 默认模型 |
|----------|------|----------|
| `deepseek` | DeepSeek API（默认） | `deepseek-v4-pro` |
| `mimo` | Mimo API | `mimo-v2.5-pro` |

#### 配置示例

**DeepSeek（默认）**
```json
{
  "provider": "deepseek",
  "apiKey": "sk-your-deepseek-key",
  "model": "deepseek-v4-flash"
}
```

**Mimo**
```json
{
  "provider": "mimo",
  "apiKey": "your-mimo-api-key",
  "model": "mimo-v2.5-pro"
}
```

#### 配置项说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `provider` | 否 | AI 服务提供商，默认 `deepseek` |
| `apiKey` | 是 | API 密钥 |
| `baseUrl` | 否 | 自定义 API 地址（可选） |
| `model` | 否 | 模型名称（可选，使用提供商默认值） |

### MCP 配置

MCP (Model Context Protocol) 允许 AI 连接外部工具服务器。在 `~/.lccode/mcp.json` 中配置：

```bash
cat > ~/.lccode/mcp.json << 'EOF'
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
EOF
```

启动时会自动加载所有配置的 MCP 服务器，AI 会根据对话需要自动调用相应的 MCP 工具。



## 项目结构

```
lccode/
├── src/
│   ├── agent/                    # AI 核心逻辑
│   │   ├── agent.ts              # Agent 主逻辑
│   │   ├── mcp/                  # MCP 协议实现
│   │   │   ├── adapter.ts        # MCP 工具适配器
│   │   │   ├── client.ts         # MCP 客户端
│   │   │   ├── manager.ts        # MCP 管理器
│   │   │   └── types.ts          # MCP 类型定义
│   │   ├── memory/               # 记忆系统
│   │   │   └── summarizer.ts     # 上下文摘要生成
│   │   ├── prompts/              # 提示词模板
│   │   │   ├── loader.ts         # 模板加载器
│   │   │   ├── prompt-template.ts # 模板引擎
│   │   │   └── templates/        # 模板文件
│   │   ├── skill/                # 技能系统
│   │   │   ├── loader.ts         # 技能文件加载
│   │   │   ├── skill-adapter.ts  # 技能适配为工具
│   │   │   ├── skill-manager.ts  # 技能管理器
│   │   │   └── types.ts          # 技能类型定义
│   │   ├── subagents/            # 子 Agent 实现
│   │   │   └── planagent.ts      # 计划任务子 Agent
│   │   └── tools/                # 工具注册中心
│   │       ├── tool-registry.ts  # 工具注册与管理
│   │       ├── file-tools.ts     # 文件操作工具
│   │       ├── command-tool.ts   # 命令执行工具
│   │       ├── agent-tool.ts     # 子 Agent 工具
│   │       └── sandbox-tool.ts   # 沙箱权限工具
│   ├── frontend/                 # Ink 组件
│   │   ├── components/           # UI 组件
│   │   │   ├── CommandSuggestion.tsx  # 命令建议
│   │   │   ├── ConfigSetup.tsx   # 配置向导
│   │   │   ├── DiffPreview.tsx   # Diff 预览
│   │   │   ├── ExitScreen.tsx    # 退出界面
│   │   │   ├── FileSuggestion.tsx # 文件建议
│   │   │   ├── Header.tsx        # 头部 Logo
│   │   │   ├── InfoLine.tsx      # 信息行
│   │   │   ├── InputLine.tsx     # 输入框
│   │   │   ├── Markdown.tsx      # Markdown 渲染
│   │   │   ├── OutputLines.tsx   # 输出行
│   │   │   ├── OutputSection.tsx # 输出区域
│   │   │   └── StatusLine.tsx    # 状态栏
│   │   ├── hooks/                # React Hooks
│   │   ├── commands.ts           # 命令处理
│   │   └── useTerminal.ts        # 终端 Hook
│   ├── services/                 # API 服务
│   │   ├── providers/            # AI 服务提供商实现
│   │   │   ├── base.ts           # OpenAI 兼容基类
│   │   │   ├── deepseek.ts       # DeepSeek 实现
│   │   │   └── mimo.ts           # Mimo 实现
│   │   ├── command-executor.ts   # 命令执行器
│   │   ├── index.ts              # 提供商工厂
│   │   └── types.ts              # 提供商接口
│   ├── types/                    # TypeScript 类型
│   │   ├── agent.ts              # Agent 类型
│   │   ├── index.ts              # 类型导出
│   │   ├── llm-output.ts         # LLM 输出类型
│   │   └── shared.ts             # 共享类型
│   ├── utils/                    # 工具函数
│   │   ├── language.ts           # 语言检测
│   │   ├── logger.ts             # 日志工具
│   │   ├── sandbox.ts            # 沙箱权限管理
│   │   └── version-checker.ts    # 版本检查
│   ├── config.ts                 # 配置加载
│   ├── app.tsx                   # 主应用组件
│   └── cli.tsx                   # CLI 入口
├── test/                         # 测试文件
└── dist/                         # 构建输出
```

## 任务清单

- [x] **多厂商模型支持**：接入 DeepSeek 和 Mimo 两家人工智能服务商，灵活切换模型
- [x] **MCP 协议集成**：支持 Model Context Protocol，扩展 AI 与外部工具的互联能力
- [x] **记忆系统**：支持跨会话的上下文记忆和摘要
- [x] **计划任务**：支持 plan_task 子 Agent，自动规划和执行复杂任务
- [x] **Skill 技能系统**：支持自定义 Markdown 技能文件，扩展 AI 能力
- [x] **沙箱权限系统**：细粒度权限控制，支持三种预设模式
- [ ] **配置热重载**：修改配置文件后无需重启即可生效
- [ ] **插件机制**：开放插件 API，允许第三方扩展功能
- [ ] **多语言支持**：优化中英文交互体验

## 技术栈

- **运行时**: Node.js + TypeScript
- **UI 框架**: Ink (React for CLI)
- **AI 服务**: DeepSeek、Mimo
- **协议支持**: MCP (Model Context Protocol)
- **构建工具**: TypeScript + tsx
- **测试**: Vitest
- **主要依赖**:
  - `@modelcontextprotocol/sdk`: ^1.29.0
  - `cli-highlight`: ^2.1.11
  - `diff`: ^9.0.0
  - `ink`: ^7.1.0
  - `openai`: ^6.45.0
  - `react`: ^19.2.7

## 常见问题

**Q: 启动时报 `Raw mode is not supported` 错误？**

程序需要在交互式终端中运行。请直接在终端中执行 `lccode`，不要通过管道或其他非 TTY 方式调用。

**Q: 如何更换模型或 API Key？**

编辑 `~/.lccode/config.json` 文件即可，修改后下次启动自动生效。

**Q: MCP 工具如何使用？**

配置 `~/.lccode/mcp.json` 后，启动时会自动加载所有配置的 MCP 服务器。AI 会根据对话需要自动调用相应的 MCP 工具。

**Q: 为什么 AI 会提示命令有风险？**

AI 内置了安全规则，会自动识别危险命令（如 `rm -rf`、`sudo rm` 等）并提示用户确认。这是为了防止误操作导致数据丢失。白名单内的安全命令会直接执行。

**Q: 如何添加自定义技能？**

在项目的 `.lccode/skills/` 目录下创建 Markdown 文件（如 `my-skill.md`），文件头部包含 `description` 字段。启动后 AI 会自动加载并可通过斜杠命令或关键词触发调用。

**Q: 如何调整沙箱权限？**

在对话中让 AI 调用 `sandbox` 工具即可，例如：`sandbox(preset="relaxed")` 切换到宽松模式，或 `sandbox(enable, permission="network")` 启用网络权限。

## 写在后面

由于平时科研任务繁重，更新较慢，有时间就会持续开发维护该项目。欢迎贡献代码和提出建议。
