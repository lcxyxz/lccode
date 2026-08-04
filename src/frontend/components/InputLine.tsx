import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { LLMStatus } from '../../types/index.js'

interface InputLineProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel?: () => void
  llmStatus: LLMStatus
}

export function InputLine({ value, onChange, onSubmit, onCancel, llmStatus }: InputLineProps) {
  const promptColor = llmStatus === 'loading' ? 'yellow' : llmStatus === 'error' ? 'red' : 'green'
  const promptIcon = llmStatus === 'loading' ? '…' : '❯'

  return (
    <Box>
      <Text color={promptColor} bold>{promptIcon} </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
      />
      {llmStatus === 'loading' && onCancel && (
        <Text color="gray" dimColor> (按 Esc 取消)</Text>
      )}
    </Box>
  )
}
