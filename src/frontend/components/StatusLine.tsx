import { Box, Text } from 'ink'
import type { LLMStatus } from '../../types/index.js'

export function StatusLine({ llmStatus, modelName }: { llmStatus: LLMStatus; modelName?: string }) {
  const statusColor = {
    idle: 'gray',
    loading: 'yellow',
    done: 'green',
    error: 'red',
  }[llmStatus]

  return (
    <Box justifyContent="space-between" paddingTop={1}>
      <Text color="gray">
        {modelName || 'AI'} │ Ctrl+C Exit
      </Text>
      <Text color={statusColor}>
        {llmStatus === 'loading' ? 'Thinking...' :
         llmStatus === 'done' ? 'Ready' :
         llmStatus === 'error' ? 'Error' : 'Idle'}
      </Text>
    </Box>
  )
}
