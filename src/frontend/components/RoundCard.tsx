import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'
import Markdown from './Markdown.js'
import { DiffPreview } from './DiffPreview.js'

const MAX_THINKING_LENGTH = 3000
const MAX_OUTPUT_LENGTH = 4000

interface RoundCardProps {
  section: OutputSectionType
  showDetails: boolean
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\n... (truncated)' : text
}

export function RoundCard({ section, showDetails }: RoundCardProps) {
  const commands = section.commands ?? []

  const thinking = section.thinking ? truncate(section.thinking, MAX_THINKING_LENGTH) : null
  const isAnswer = !!section.content && commands.length === 0
  const onlyThinking = !!(thinking && commands.length === 0 && !section.content && !section.diffPreview)

  // 最终答案卡片：绿色单线边框 + 回答标题
  if (isAnswer) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="green"
        paddingX={1}
        paddingTop={1}
        marginBottom={1}
      >
        {showDetails && thinking && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="gray" bold>思考内容</Text>
            <Text color="gray" dimColor>{thinking}</Text>
          </Box>
        )}
        <Markdown>{section.content}</Markdown>
      </Box>
    )
  }

  // 工具执行卡片：灰色圆角边框
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingTop={1}
      marginBottom={1}
    >
      {onlyThinking && !showDetails && (
        <Text color="gray" dimColor>思考内容（Tab 展开）</Text>
      )}

      {commands.map((cmd, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text color={cmd.success ? 'green' : 'red'} dimColor>$ {cmd.command}</Text>
          {showDetails && cmd.output && (
            <Box flexDirection="column" marginLeft={2} marginTop={1}>
              <Text color="gray" bold>执行结果</Text>
              <Text color="gray" dimColor>{truncate(cmd.output, MAX_OUTPUT_LENGTH)}</Text>
            </Box>
          )}
        </Box>
      ))}

      {showDetails && thinking && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          <Text color="gray" bold>思考内容</Text>
          <Text color="gray" dimColor>{thinking}</Text>
        </Box>
      )}

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
