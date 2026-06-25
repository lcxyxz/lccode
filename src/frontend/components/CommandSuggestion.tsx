import { Box, Text } from 'ink'

/**
 * 命令提示组件
 */
export function CommandSuggestion({
  commands,
  selectedIndex,
}: {
  commands: string[]
  selectedIndex: number
}) {
  return (
    <Box flexDirection="column" borderTop={true} borderColor="gray" paddingTop={1} marginBottom={1}>
      <Text color="gray" dimColor>↑↓ Navigate │ Tab Select │ Esc Dismiss</Text>
      {commands.map((cmd, i) => (
        <Box key={cmd}>
          <Text
            color={i === selectedIndex ? 'black' : 'cyan'}
            bold={i === selectedIndex}
            backgroundColor={i === selectedIndex ? 'cyan' : undefined}
          >
            {` ${i === selectedIndex ? '>' : ' '} ${cmd} `}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
