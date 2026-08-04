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
    loading: '…',
    done: '●',
    error: '×',
  }[llmStatus]

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <Box justifyContent="space-between" paddingTop={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray">
      <Box>
        <Text color="cyan" bold>{modelName || 'AI'}</Text>
        <Text color="gray"> │ Ctrl+C Exit</Text>
      </Box>
      <Box>
        {tokenUsage && tokenUsage.totalTokens > 0 && (
          <Text color="gray" dimColor>
            Prompt: {formatTokens(tokenUsage.promptTokens)} │ Completion: {formatTokens(tokenUsage.completionTokens)} │ Total: {formatTokens(tokenUsage.totalTokens)} │{' '}
          </Text>
        )}
        <Text color={statusColor}>
          <Text bold>{statusIcon}</Text>{' '}
          {llmStatus === 'loading' ? 'Thinking...' :
           llmStatus === 'done' ? 'Ready' :
           llmStatus === 'error' ? 'Error' : 'Idle'}
        </Text>
      </Box>
    </Box>
  )
}
