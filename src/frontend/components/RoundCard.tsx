import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'
import Markdown from './Markdown.js'
import { DiffPreview } from './DiffPreview.js'

const MAX_ROUND_ACTION_LENGTH = 3000

interface RoundCardProps {
  section: OutputSectionType
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\n... (truncated)' : text
}

export function RoundCard({ section }: RoundCardProps) {
  const commands = section.commands ?? []

  const roundAction = section.thinking ? truncate(section.thinking, MAX_ROUND_ACTION_LENGTH) : null
  const isAnswer = !!section.content && commands.length === 0

  // 最终答案：直接展示内容
  if (isAnswer) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Markdown>{section.content}</Markdown>
      </Box>
    )
  }

  // 工具执行：直接展示行动说明与执行命令
  return (
    <Box flexDirection="column" marginBottom={1}>
      {roundAction && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>{roundAction}</Text>
        </Box>
      )}

      {commands.map((cmd, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text color={cmd.success ? 'green' : 'red'} dimColor>$ {cmd.command}</Text>
        </Box>
      ))}

      {section.diffPreview && (
        <DiffPreview
          filePath={section.diffPreview.filePath}
          language={section.diffPreview.language}
          lines={section.diffPreview.lines}
        />
      )}

      {section.content && <Markdown>{section.content}</Markdown>}
    </Box>
  )
}
