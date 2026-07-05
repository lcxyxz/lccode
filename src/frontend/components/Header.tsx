import { Box, Text } from 'ink'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { useUpdateCheck } from '../hooks/useUpdateCheck.js'

const logoPath = join(homedir(), '.lccode', 'logo.txt')
const logo = existsSync(logoPath) ? readFileSync(logoPath, 'utf-8') : ''

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
