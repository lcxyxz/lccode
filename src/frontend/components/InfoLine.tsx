import { Box, Text } from 'ink'
import { useState, useEffect } from 'react'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
const execAsync = promisify(exec)
interface InfoLineProps {
  branchVersion?: number
}
export function InfoLine({ branchVersion }: InfoLineProps) {
  const [folderName, setFolderName] = useState('')

  const [gitBranch, setGitBranch] = useState('')

  useEffect(() => {
    setFolderName(path.basename(process.cwd()))

    execAsync('git branch --show-current')
      .then(({ stdout }) => setGitBranch(stdout.trim()))
      .catch(() => setGitBranch(''))
      
  }, [branchVersion])

  return (
    <Box justifyContent="flex-start">
      <Text color="cyan">
        {folderName}{gitBranch ? `:${gitBranch}` : ''}
      </Text>
    </Box>
  )
}