import { Box, Text } from 'ink'
import type { LLMStatus } from '../../types/index.js'

export function Header({ llmStatus }: { llmStatus: LLMStatus }) {
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

  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text color="cyan" bold>Terminal Assistant</Text>
      <Text color={statusColor}>{statusIcon}</Text>
    </Box>
  )
}
