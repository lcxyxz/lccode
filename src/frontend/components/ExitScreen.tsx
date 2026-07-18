import { Box, Text } from 'ink'
import { Header } from './Header.js'

export function ExitScreen() {
  return (
    <Box flexDirection="column">
      <Header />
      <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Text color="cyan" bold>Goodbye!</Text>
          <Text color="gray">Thanks for using lccode</Text>
        </Box>
      </Box>
    </Box>
  )
}
