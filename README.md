# lccode

一个基于 Ink 构建的极简终端 AI 编程助手，支持 DeepSeek 和 Mimo 两家 AI 服务提供商。

## 功能特性

- AI 对话：支持 DeepSeek 和 Mimo 两家服务商
- 命令执行：AI 可以生成并执行终端命令
- 实时反馈：命令执行结果实时显示
- 思考过程：显示 AI 的思考过程（可选）
- 交互式界面：基于 Ink 的终端 UI，支持命令建议
- 代码预览：创建或修改文件后自动展示语法高亮的代码预览

## 效果展示

### 创建文件

AI 创建 Java 文件时，自动展示带行号和语法高亮的代码预览：

![创建文件](imgs/image1.png)

### 编辑文件

AI 编辑文件后，实时展示修改后的完整代码：

![编辑文件](imgs/image2.png)

### 最终效果

底部状态栏显示模型名称、Token 用量和当前状态：

![最终效果](imgs/image3.png)

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置

在用户家目录下创建 `.lccode.json` 配置文件：

```bash
cat > ~/.lccode.json << 'EOF'
{
  "provider": "deepseek",
  "apiKey": "your-api-key",
  "model": "deepseek-v4-flash"
}
EOF
```

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


### 全局安装（推荐）

构建项目后，通过软链接注册全局命令：

```bash
npm run build
npm link
```

之后在任意目录下直接运行：

```bash
lccode
```

### 本地运行

```bash
npm start
```

## 开发命令

```bash
# 开发模式
npm start

# 构建
npm run build

# 运行测试
npm test

# 监视测试
npm run test:watch
```

## 项目结构

```
lccode/
├── src/
│   ├── agent/           # AI 核心逻辑
│   ├── frontend/        # Ink 组件
│   ├── services/        # API 服务
│   │   ├── providers/   # AI 服务提供商实现
│   │   │   ├── deepseek.ts
│   │   │   └── mimo.ts
│   │   ├── index.ts     # 提供商工厂
│   │   └── types.ts     # 提供商接口
│   ├── types/           # TypeScript 类型
│   ├── config.ts        # 配置加载（读取 ~/.lccode.json）
│   ├── app.tsx          # 主应用组件
│   └── cli.tsx          # CLI 入口
├── test/                # 测试文件
└── dist/                # 构建输出
```

## 任务清单

- [x] **多厂商模型支持**：接入 DeepSeek 和 Mimo 两家人工智能服务商，灵活切换模型
- [ ] **MCP 协议集成**：支持 Model Context Protocol，扩展 AI 与外部工具的互联能力
- [ ] **Skill 技能系统**：支持自定义技能/工具，让 AI 调用更丰富的本地能力（如文件搜索、代码分析等）
- [ ] **会话历史管理**：支持保存和加载历史对话，方便回溯
- [ ] **配置热重载**：修改配置文件后无需重启即可生效
- [ ] **插件机制**：开放插件 API，允许第三方扩展功能
- [ ] **多语言支持**：优化中英文交互体验

## 技术栈

- **运行时**: Node.js + TypeScript
- **UI 框架**: Ink (React for CLI)
- **AI 服务**: DeepSeek、Mimo
- **构建工具**: TypeScript + tsx
- **测试**: Vitest

## 常见问题

**Q: 启动时报 `Raw mode is not supported` 错误？**

这是因为程序需要在交互式终端中运行。请直接在终端中执行 `lccode`，不要通过管道或其他非 TTY 方式调用。

**Q: 如何更换模型或 API Key？**

编辑 `~/.lccode.json` 文件即可，修改后下次启动自动生效。

## 写在后面

当前项目还在持续开发中。。。
