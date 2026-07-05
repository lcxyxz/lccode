import { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ProviderType } from '../../types/shared.js'

const USER_CONFIG_DIR = join(homedir(), '.lccode')
const USER_CONFIG_FILE = join(USER_CONFIG_DIR, 'config.json')

interface ConfigSetupProps {
  onComplete: (apiKey: string, model: string, provider: ProviderType, baseUrl?: string) => void
}

type Step = 'welcome' | 'apikey' | 'provider' | 'model' | 'baseurl' | 'done'

const PROVIDERS: { label: string; value: ProviderType; defaultModel: string }[] = [
  { label: 'deepseek', value: 'deepseek', defaultModel: 'deepseek-v4-flash' },
  { label: 'mimo', value: 'mimo', defaultModel: 'mimo-v2-flash' },
]

export function ConfigSetup({ onComplete }: ConfigSetupProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<ProviderType>('deepseek')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [baseUrl, setBaseUrl] = useState('')

  const saveConfig = (cfg: { apiKey: string; model: string; provider: ProviderType; baseUrl?: string }) => {
    if (!existsSync(USER_CONFIG_DIR)) {
      mkdirSync(USER_CONFIG_DIR, { recursive: true })
    }
    writeFileSync(USER_CONFIG_FILE, JSON.stringify(cfg, null, 2))
  }

  const handleInput = (value: string) => {
    setInput(value)
  }

  const handleSubmit = (value: string) => {
    const v = value.trim()

    switch (step) {
      case 'welcome':
        setStep('apikey')
        break
      case 'apikey':
        if (!v) {
          return
        }
        setApiKey(v)
        setStep('provider')
        break
      case 'provider': {
        const idx = parseInt(v, 10)
        const selected = PROVIDERS[idx - 1] || PROVIDERS[0]
        setProvider(selected.value)
        setModel(selected.defaultModel)
        setStep('model')
        break
      }
      case 'model':
        if (v) {
          setModel(v)
        }
        setStep('baseurl')
        break
      case 'baseurl':
        if (v) {
          setBaseUrl(v)
        }
        saveConfig({ apiKey, model, provider, baseUrl: v || undefined })
        setStep('done')
        onComplete(apiKey, model, provider, v || undefined)
        break
    }

    setInput('')
  }

  return (
    <Box flexDirection="column" padding={1}>
      {step === 'welcome' && (
        <>
          <Text color="cyan" bold>欢迎使用 lccode！</Text>
          <Text>首次使用需要配置模型参数。</Text>
          <Box marginTop={1}>
            <Text color="green" bold>{'> '}</Text>
            <TextInput
              value=""
              onChange={() => {}}
              onSubmit={() => setStep('apikey')}
              placeholder="按回车开始配置"
            />
          </Box>
        </>
      )}

      {step === 'apikey' && (
        <>
          <Text color="cyan" bold>步骤 1/4 - API Key</Text>
          <Text>请输入你的 API Key：</Text>
          <Text color="gray">（可从 deepseek.com 获取）</Text>
          <Box marginTop={1}>
            <Text color="green" bold>{'> '}</Text>
            <TextInput
              value={input}
              onChange={handleInput}
              onSubmit={handleSubmit}
              mask="*"
            />
          </Box>
        </>
      )}

      {step === 'provider' && (
        <>
          <Text color="cyan" bold>步骤 2/4 - 模型提供商</Text>
          <Text>请选择模型提供商：</Text>
          {PROVIDERS.map((p, i) => (
            <Text key={p.value}>  {i + 1}. {p.label}</Text>
          ))}
          <Box marginTop={1}>
            <Text color="green" bold>{'> '}</Text>
            <TextInput
              value={input}
              onChange={handleInput}
              onSubmit={handleSubmit}
              placeholder="1"
            />
          </Box>
        </>
      )}

      {step === 'model' && (
        <>
          <Text color="cyan" bold>步骤 3/4 - 模型名称</Text>
          <Text>请输入模型名称（直接回车使用默认值）：</Text>
          <Text color="gray">默认：{PROVIDERS.find(p => p.value === provider)?.defaultModel || 'deepseek-v4-flash'}</Text>
          <Box marginTop={1}>
            <Text color="green" bold>{'> '}</Text>
            <TextInput
              value={input}
              onChange={handleInput}
              onSubmit={handleSubmit}
              placeholder={PROVIDERS.find(p => p.value === provider)?.defaultModel || 'deepseek-v4-flash'}
            />
          </Box>
        </>
      )}

      {step === 'baseurl' && (
        <>
          <Text color="cyan" bold>步骤 4/4 - Base URL（可选）</Text>
          <Text>请输入自定义 API 地址（直接回车跳过）：</Text>
          <Text color="gray">适用于自建代理或第三方兼容 API</Text>
          <Box marginTop={1}>
            <Text color="green" bold>{'> '}</Text>
            <TextInput
              value={input}
              onChange={handleInput}
              onSubmit={handleSubmit}
              placeholder="留空跳过"
            />
          </Box>
        </>
      )}

      {step === 'done' && (
        <Text color="green" bold>配置完成！正在启动...</Text>
      )}
    </Box>
  )
}
