import { Box, Text } from 'ink'
import type { LLMStatus } from '../../types/index.js'
import type { TerminalMode } from '../useTerminal.js'

/**
 * 单行紧凑头部组件
 * 极简主义设计，显示应用名称和状态
 */
export function Header({ llmStatus, mode }: { llmStatus: LLMStatus; mode: TerminalMode }) {
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
      <Text color="cyan" bold>❯ Terminal Assistant</Text>
      <Box>
        <Text color={mode === 'visual' ? 'yellow' : 'gray'}>
          {mode === 'visual' ? '-- VISUAL --' : '-- INSERT --'}
        </Text>
        <Text color="gray"> </Text>
        <Text color={statusColor}>{statusIcon}</Text>
      </Box>
    </Box>
  )
}
