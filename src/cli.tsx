#!/usr/bin/env node
import { loadConfig } from './config.js'

const config = loadConfig()
if (config) {
  process.env.LCCODE_API_KEY = config.apiKey
  if (config.baseUrl) process.env.LCCODE_BASE_URL = config.baseUrl
  if (config.model) process.env.LCCODE_MODEL = config.model
  if (config.provider) process.env.LCCODE_PROVIDER = config.provider
} else {
  throw new Error("请先配置模型！！！")
}

import { render } from 'ink'
import App from './app.js'

const { waitUntilExit } = render(<App onExit={() => setTimeout(() => process.exit(0), 50)} />, { exitOnCtrlC: false })

waitUntilExit().then(() => {
  process.exit(0)
})
