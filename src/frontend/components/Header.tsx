import { Box, Text } from 'ink'
import { useUpdateCheck } from '../hooks/useUpdateCheck.js'
import { getLogo } from '../../config.js'

const logo = getLogo()

export function Header() {
  const { message } = useUpdateCheck()
  const logoLines = logo.split('\n')

  return (
    <Box flexDirection="column" marginBottom={1}>
      {logoLines.map((line, i) => (
        <Text key={i} color="cyan" bold>{line}</Text>
      ))}
      {message && (
        <Text color="yellow" bold>{message}</Text>
      )}
    </Box>
  )
}
