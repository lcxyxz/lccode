import { Box, Text } from 'ink'
import type { TokenUsage } from '../../types/index.js'
import { Header } from './Header.js'

export function ExitScreen({ tokenUsage }: { tokenUsage: TokenUsage }) {
  return (
    <Box flexDirection="column">
      <Header />
      <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Text color="cyan" bold>Goodbye!</Text>
          <Text color="gray">Thanks for using lccode</Text>
          {tokenUsage.totalTokens > 0 && (
            <Text color="gray">
              Tokens used: {tokenUsage.totalTokens.toLocaleString()} ({tokenUsage.promptTokens.toLocaleString()} prompt + {tokenUsage.completionTokens.toLocaleString()} completion)
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}
