import { Box, Text } from 'ink'
import type { LLMStatus } from '../../types/index.js'
import type { TerminalMode } from '../useTerminal.js'

/**
 * 状态栏组件
 */
export function StatusLine({ llmStatus, mode, modelName }: { llmStatus: LLMStatus; mode: TerminalMode; modelName?: string }) {
  const statusColor = {
    idle: 'gray',
    loading: 'yellow',
    done: 'green',
    error: 'red',
  }[llmStatus]

  return (
    <Box justifyContent="space-between" paddingTop={1}>
      <Text color="gray">
        {modelName || 'AI'} │ {mode === 'visual' ? '↑↓ Navigate │ Enter/Space Toggle │ Esc Insert' : 'Esc Visual │ Ctrl+C Exit'}
      </Text>
      <Text color={statusColor}>
        {llmStatus === 'loading' ? '⟳ Thinking...' :
         llmStatus === 'done' ? '✓ Ready' :
         llmStatus === 'error' ? '✗ Error' : '○ Idle'}
      </Text>
    </Box>
  )
}