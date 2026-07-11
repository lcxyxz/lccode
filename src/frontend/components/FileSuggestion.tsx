import { Box, Text } from 'ink'
import type { FileMatch } from '../hooks/useFileSuggestions.js'

export function FileSuggestion({ files, selectedIndex }: { files: FileMatch[]; selectedIndex: number }) {
  return (
    <Box flexDirection="column" borderTop={true} borderColor="gray" paddingTop={1} marginBottom={1}>
      <Text color="gray" dimColor>↑↓ Navigate │ Tab Select │ Esc Dismiss</Text>
      {files.map((f, i) => (
        <Box key={f.path}>
          <Text color={i === selectedIndex ? 'black' : 'cyan'} bold={i === selectedIndex} backgroundColor={i === selectedIndex ? 'cyan' : undefined}>
            {` ${i === selectedIndex ? '>' : ' '} ${f.path} `}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
