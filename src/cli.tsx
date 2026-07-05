#!/usr/bin/env node
import { loadConfig } from './config.js'
import type { LccodeConfig } from './config.js'
import type { ProviderType } from './types/shared.js'
import { useState, useEffect } from 'react'
import { render } from 'ink'
import { ConfigSetup } from './frontend/components/ConfigSetup.js'
import App from './app.js'

function Root({ onExit }: { onExit?: () => void }) {
  const [config, setConfig] = useState<LccodeConfig | null>(() => loadConfig())

  const handleConfigComplete = (apiKey: string, model: string, provider: ProviderType, baseUrl?: string) => {
    process.env.LCCODE_API_KEY = apiKey
    if (baseUrl) process.env.LCCODE_BASE_URL = baseUrl
    process.env.LCCODE_MODEL = model
    process.env.LCCODE_PROVIDER = provider

    setConfig({ apiKey, model, provider, baseUrl })
  }

  if (!config) {
    return <ConfigSetup onComplete={handleConfigComplete} />
  }

  return <App onExit={onExit} />
}

// 在启动时就设置好已有配置的环境变量
const existingConfig = loadConfig()
if (existingConfig) {
  process.env.LCCODE_API_KEY = existingConfig.apiKey
  if (existingConfig.baseUrl) process.env.LCCODE_BASE_URL = existingConfig.baseUrl
  if (existingConfig.model) process.env.LCCODE_MODEL = existingConfig.model
  if (existingConfig.provider) process.env.LCCODE_PROVIDER = existingConfig.provider
}

const { waitUntilExit } = render(<Root onExit={() => setTimeout(() => process.exit(0), 50)} />, { exitOnCtrlC: false })

waitUntilExit().then(() => {
  process.exit(0)
})
