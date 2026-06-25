import { Box, Text } from 'ink'
import type { OutputSection as OutputSectionType } from '../../types/index.js'
import type { TerminalMode } from '../useTerminal.js'

interface OutputSectionProps {
  section: OutputSectionType
  isFocused?: boolean
  onToggle?: (id: number) => void
  mode: TerminalMode
}

/**
 * 可折叠的输出区块组件
 * 极简主义设计，改进焦点反馈
 */
export function OutputSection({ section, isFocused, onToggle, mode }: OutputSectionProps) {
  const { id, type, title, content, collapsed, color } = section
  const canCollapse = type === 'command' || type === 'thinking'

  const icon = {
    command: '⌘',
    thinking: '💭',
    response: '💬',
    message: '✉',
  }[type]

  // 可视化模式下，可聚焦区块有特殊高亮
  const isVisualFocus = mode === 'visual' && isFocused

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* 区块标题行 */}
      {canCollapse && (
        <Box>
          <Text
            color={isVisualFocus ? 'yellow' : isFocused ? 'cyan' : collapsed ? 'gray' : 'cyan'}
            bold={isVisualFocus}
          >
            {isVisualFocus ? '▸' : collapsed ? '▶' : '▼'}
          </Text>
          <Text color="gray"> </Text>
          <Text color="gray">{icon} </Text>
          <Text color={isVisualFocus ? 'yellow' : isFocused ? 'cyan' : color || 'white'} bold={isVisualFocus}>
            {title}
          </Text>
          {/* {collapsed && (
            <Text color="gray"> (展开)</Text>
          )} */}
          {isVisualFocus && (
            <Text color="yellow"> [Enter/Space 展开]</Text>
          )}
        </Box>
      )}

      {/* 区块内容（未折叠时显示） */}
      {!collapsed && (
        <Box flexDirection="column" paddingLeft={canCollapse ? 2 : 0}>
          {type === 'command' && (
            <Text color="green">{content}</Text>
          )}
          {type === 'thinking' && (
            <Text color="gray" italic>{content}</Text>
          )}
          {type === 'response' && (
            <Text color="white">{content}</Text>
          )}
          {type === 'message' && (
            <Text color={color || 'white'}>{content}</Text>
          )}
        </Box>
      )}

      {/* 折叠时显示摘要 */}
      {collapsed && canCollapse && (
        <Box paddingLeft={2}>
          <Text color={isVisualFocus ? 'yellow' : 'gray'}>
            {content.length > 60 ? content.slice(0, 60) + '...' : content}
          </Text>
        </Box>
      )}
    </Box>
  )
}