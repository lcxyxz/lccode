import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'
import Markdown from './Markdown.js'
import { DiffPreview } from './DiffPreview.js'

const MAX_CONTENT_LENGTH = 10000

interface OutputSectionProps {
  section: OutputSectionType
}

export function OutputSection({ section }: OutputSectionProps) {
  if (!section) return null

  const { type, content, color } = section
  if (typeof content !== 'string' && type !== 'diff_preview') return null
  if (type !== 'diff_preview' && !content) return null

  if (type === 'diff_preview' && section.diffPreview) {
    return (
      <DiffPreview
        filePath={section.diffPreview.filePath}
        language={section.diffPreview.language}
        lines={section.diffPreview.lines}
      />
    )
  }

  const truncatedContent = content.length > MAX_CONTENT_LENGTH
    ? content.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)'
    : content

  const safeColor = color || (type === 'command' ? 'green' : type === 'response' ? 'white' : 'gray')

  if (type === 'response') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Markdown>{truncatedContent}</Markdown>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={safeColor}>{truncatedContent}</Text>
    </Box>
  )
}
