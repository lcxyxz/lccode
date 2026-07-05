import { Box, Text } from 'ink'
import { highlight } from 'cli-highlight'
import type { DiffLine } from '../../types/shared.js'

interface DiffPreviewProps {
  filePath: string
  language: string
  lines: DiffLine[]
}

const MAX_LINES = 50

export function DiffPreview({ filePath, language, lines }: DiffPreviewProps) {
  const truncated = lines.length > MAX_LINES
  const displayLines = truncated ? lines.slice(0, MAX_LINES) : lines

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold> {filePath}</Text>
        <Text color="gray"> (diff)</Text>
        {truncated && (
          <Text color="gray"> ({lines.length} lines, showing first {MAX_LINES})</Text>
        )}
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {displayLines.map((line, i) => {
          let highlighted: string
          try {
            highlighted = highlight(line.content, { language })
          } catch {
            highlighted = line.content
          }

          if (line.type === 'added') {
            return (
              <Text key={i}>
                <Text color="green" dimColor>{'+'.padStart(4)} </Text>
                <Text color="green">{highlighted}</Text>
              </Text>
            )
          }

          if (line.type === 'removed') {
            return (
              <Text key={i}>
                <Text color="red" dimColor>{'-'.padStart(4)} </Text>
                <Text color="red">{highlighted}</Text>
              </Text>
            )
          }

          return (
            <Text key={i}>
              <Text color="gray" dimColor>{String(line.lineNumber).padStart(3)} </Text>
              <Text>{highlighted}</Text>
            </Text>
          )
        })}
      </Box>
    </Box>
  )
}
