import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ProviderType } from './types/shared.js'

export type { ProviderType }

export interface LccodeConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  provider?: ProviderType
}

const USER_CONFIG_DIR = join(homedir(), '.lccode')
const USER_CONFIG_FILE = join(USER_CONFIG_DIR, 'config.json')

const PROJECT_CONFIG_DIR = join(process.cwd(), '.lccode')
const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, 'config.json')

const MEMORY_DIR = join(PROJECT_CONFIG_DIR, 'memory')
const MEMORY_SESSIONS_DIR = join(MEMORY_DIR, 'sessions')

const DEFAULT_CONFIG: LccodeConfig = {
  apiKey: '',
  model: 'deepseek-v4-flash',
  provider: 'deepseek',
}

const DEFAULT_LOGO = `
 ▀██▀                          █▄
  ██                           ██
  ██      ▄███▀ ▄███▀ ▄███▄ ▄████ ▄█▀█▄
  ██      ██    ██    ██ ██ ██ ██ ██▄█▀
 ████████▄▀███▄▄▀███▄▄▀███▀ █▀███▄▀█▄▄▄`

export function getLogo(): string {
  return DEFAULT_LOGO
}

function initConfigDir(): void {
  mkdirSync(USER_CONFIG_DIR, { recursive: true })
  if (!existsSync(USER_CONFIG_FILE)) {
    writeFileSync(USER_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
  }
  // 初始化项目级 .lccode 目录（如果不存在则静默跳过）
  if (existsSync(PROJECT_CONFIG_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true })
    mkdirSync(MEMORY_SESSIONS_DIR, { recursive: true })
  }
}

function readConfigFile(filePath: string): Partial<LccodeConfig> | null {
  try {
    if (!existsSync(filePath)) return null
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
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

export function loadConfig(): LccodeConfig | null {
  initConfigDir()

  // 优先级：项目级 > 用户级
  const projectConfig = readConfigFile(PROJECT_CONFIG_FILE)
  const userConfig = readConfigFile(USER_CONFIG_FILE)

  // 合并：项目级字段覆盖用户级
  const merged = { ...userConfig, ...projectConfig }

  if (!merged.apiKey) return null
  return {
    apiKey: merged.apiKey!,
    baseUrl: merged.baseUrl,
    model: merged.model,
    provider: merged.provider,
  }
}
