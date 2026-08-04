import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'
import { RoundCard } from './RoundCard.js'

const MAX_CONTENT_LENGTH = 10000

interface OutputSectionProps {
  section: OutputSectionType
  showDetails: boolean
}

export function OutputSection({ section, showDetails }: OutputSectionProps) {
  if (!section) return null

  if (section.type === 'round') {
    return <RoundCard section={section} showDetails={showDetails} />
  }

  if (!section.content) return null

  const truncatedContent = section.content.length > MAX_CONTENT_LENGTH
    ? section.content.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)'
    : section.content

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={section.color || 'gray'}>{truncatedContent}</Text>
    </Box>
  )
}
