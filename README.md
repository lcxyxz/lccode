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

### 配置环境变量

复制 `.env.example` 为 `.env`，并填入你的 API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

### 运行

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

## 写在后面

当前项目还在持续开发中。。。
