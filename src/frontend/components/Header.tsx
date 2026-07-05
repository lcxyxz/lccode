import { Box, Text } from 'ink'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const logoPath = join(homedir(), '.lccode', 'logo.txt')
const logo = existsSync(logoPath) ? readFileSync(logoPath, 'utf-8') : ''

export function Header() {
  const logoLines = logo.split('\n')

  return (
    <Box flexDirection="column" marginBottom={1}>
      {logoLines.map((line, i) => (
        <Text key={i} color="cyan" bold>{line}</Text>
      ))}
    </Box>
  )
}
