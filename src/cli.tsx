#!/usr/bin/env node
// CLI 入口文件：使用 Ink 渲染 React 终端界面
import 'dotenv/config'
import { render } from 'ink'
import App from './app.js'

// 渲染 App 组件到终端，并获取等待退出的 Promise
const { waitUntilExit } = render(<App onExit={() => setTimeout(() => process.exit(0), 50)} />, { exitOnCtrlC: false })

// 当应用退出时，结束 Node.js 进程
waitUntilExit().then(() => {
  process.exit(0)
})
