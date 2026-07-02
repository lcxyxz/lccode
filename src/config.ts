import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export type ProviderType = 'deepseek' | 'mimo'

export interface LccodeConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  provider?: ProviderType
}

const CONFIG_FILE = '.lccode.json'

export function loadConfig(): LccodeConfig | null {
  const configPath = join(homedir(), CONFIG_FILE)
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const data = JSON.parse(raw)
    if (!data.apiKey) return null
    return {
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      model: data.model,
      provider: data.provider,
    }
  } catch {
    return null
  }
}
