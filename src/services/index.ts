/**
 * Provider Factory
 * Creates the appropriate LLM provider based on configuration
 */

import type { ProviderType } from '../types/shared.js'
import type { LLMProvider, ProviderConfig } from './types.js'
import { DeepSeekProvider } from './providers/deepseek.js'
import { MimoProvider } from './providers/mimo.js'

export type { ProviderType }

export function createProvider(config: ProviderConfig & { provider?: ProviderType }): LLMProvider {
  const provider = config.provider || 'deepseek'

  switch (provider) {
    case 'mimo':
      return new MimoProvider(config)
    case 'deepseek':
      return new DeepSeekProvider(config)
    default:
      throw new Error(`Unknown provider: ${provider}. Supported providers: deepseek, mimo`)
  }
}

export type { LLMProvider, ProviderConfig } from './types.js'
