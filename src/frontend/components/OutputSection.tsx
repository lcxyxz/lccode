import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'

const MAX_CONTENT_LENGTH = 10000

interface OutputSectionProps {
  section: OutputSectionType
}

export function OutputSection({ section }: OutputSectionProps) {
  if (!section) return null

  const { type, content, color } = section
  if (typeof content !== 'string' || !content) return null

  const truncatedContent = content.length > MAX_CONTENT_LENGTH
    ? content.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)'
    : content

  const safeColor = color || (type === 'command' ? 'green' : type === 'response' ? 'white' : 'gray')

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={safeColor}>{truncatedContent}</Text>
    </Box>
  )
}
