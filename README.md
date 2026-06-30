# lccode

一个基于 Ink 构建的极简终端 AI 编程助手，集成 DeepSeek API，支持命令执行和对话交互。

## 功能特性

- AI 对话：与 DeepSeek 模型进行自然语言交互
- 命令执行：AI 可以生成并执行终端命令
- 实时反馈：命令执行结果实时显示
- 思考过程：显示 AI 的思考过程（可选）
- 交互式界面：基于 Ink 的终端 UI，支持命令建议

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
  "apiKey": "your-api-key",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-flash"
}
EOF
```

配置项说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `apiKey` | 是 | DeepSeek API 密钥 |
| `baseUrl` | 否 | API 地址，默认 `https://api.deepseek.com` |
| `model` | 否 | 模型名称，默认 `deepseek-v4-flash` |

> 如果 `~/.lccode.json` 不存在，程序会回退读取项目目录下的 `.env` 文件。

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
│   ├── types/           # TypeScript 类型
│   ├── config.ts        # 配置加载（读取 ~/.lccode.json）
│   ├── app.tsx          # 主应用组件
│   └── cli.tsx          # CLI 入口
├── test/                # 测试文件
└── dist/                # 构建输出
```

## 技术栈

- **运行时**: Node.js + TypeScript
- **UI 框架**: Ink (React for CLI)
- **AI 服务**: DeepSeek API
- **构建工具**: TypeScript + tsx
- **测试**: Vitest

## 常见问题

**Q: 启动时报 `Raw mode is not supported` 错误？**

这是因为程序需要在交互式终端中运行。请直接在终端中执行 `lccode`，不要通过管道或其他非 TTY 方式调用。

**Q: 如何更换模型或 API Key？**

编辑 `~/.lccode.json` 文件即可，修改后下次启动自动生效。

## 写在后面

当前项目还在持续开发中。。。
