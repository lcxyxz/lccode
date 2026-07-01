import { Box, Text } from 'ink'
import { highlight } from 'cli-highlight'

interface CodePreviewProps {
  filePath: string
  language: string
  content: string
}

const MAX_LINES = 50

export function CodePreview({ filePath, language, content }: CodePreviewProps) {
  const lines = content.split('\n')
  const truncated = lines.length > MAX_LINES
  const displayLines = truncated ? lines.slice(0, MAX_LINES) : lines

  let highlighted: string
  try {
    highlighted = highlight(displayLines.join('\n'), { language })
  } catch {
    highlighted = displayLines.join('\n')
  }

  const highlightedLines = highlighted.split('\n')

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold> {filePath}</Text>
        {truncated && (
          <Text color="gray"> ({lines.length} lines, showing first {MAX_LINES})</Text>
        )}
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {highlightedLines.map((line, i) => (
          <Text key={i}>
            <Text color="gray" dimColor>{String(lines.length > MAX_LINES ? i + 1 : i + 1).padStart(3)} </Text>
            <Text>{line}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}
