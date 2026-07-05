import { Box, Text } from 'ink'
import type { LLMStatus, TokenUsage } from '../../types/index.js'

interface StatusLineProps {
  llmStatus: LLMStatus
  modelName?: string
  tokenUsage?: TokenUsage
}

export function StatusLine({ llmStatus, modelName, tokenUsage }: StatusLineProps) {
  const statusColor = {
    idle: 'gray',
    loading: 'yellow',
    done: 'green',
    error: 'red',
  }[llmStatus]

  const statusIcon = {
    idle: '○',
    loading: '◌',
    done: '●',
    error: '✗',
  }[llmStatus]

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <Box justifyContent="space-between" paddingTop={1}>
      <Text color="gray">
        {modelName || 'AI'} │ Ctrl+C Exit
      </Text>
      <Box>
        {tokenUsage && tokenUsage.totalTokens > 0 && (
          <Text color="gray">
            Prompt: {formatTokens(tokenUsage.promptTokens)} │ Completion: {formatTokens(tokenUsage.completionTokens)} │ Total: {formatTokens(tokenUsage.totalTokens)} │{' '}
          </Text>
        )}
        <Text color={statusColor}>
          {statusIcon} {llmStatus === 'loading' ? 'Thinking...' :
           llmStatus === 'done' ? 'Ready' :
           llmStatus === 'error' ? 'Error' : 'Idle'}
        </Text>
      </Box>
    </Box>
  )
}
