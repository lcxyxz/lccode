import { Box, Text } from 'ink'
import type { LLMStatus } from '../../types/index.js'

/**
 * 输入行组件
 * 极简主义设计，无边框，支持溢出处理
 */
export function InputLine({
  input,
  cursorVisible,
  llmStatus,
}: {
  input: string
  cursorVisible: boolean
  llmStatus: LLMStatus
}) {
  const terminalWidth = process.stdout.columns || 80
  const promptColor = llmStatus === 'loading' ? 'yellow' : 'green'
  const statusIcon = llmStatus === 'loading' ? '⟳' : llmStatus === 'error' ? '✗' : '❯'

  // 处理输入溢出：保留提示符(2) + 光标(1) + 边距(1) = 4 字符
  const maxVisible = terminalWidth - 4
  const visibleInput = input.length > maxVisible
    ? input.slice(input.length - maxVisible)
    : input

  return (
    <Box>
      <Text color={promptColor} bold>{statusIcon} </Text>
      <Text color="white">{visibleInput}</Text>
      <Text color={promptColor} bold>{cursorVisible ? '▌' : ' '}</Text>
    </Box>
  )
}
