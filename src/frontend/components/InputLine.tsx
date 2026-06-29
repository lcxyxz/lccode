import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { LLMStatus } from '../../types/index.js'

interface InputLineProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  llmStatus: LLMStatus
}

export function InputLine({ value, onChange, onSubmit, llmStatus }: InputLineProps) {
  const promptColor = llmStatus === 'loading' ? 'yellow' : 'green'
  const statusIcon = llmStatus === 'loading' ? '...' : llmStatus === 'error' ? '!' : '>'

  return (
    <Box>
      <Text color={promptColor} bold>{statusIcon} </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </Box>
  )
}
