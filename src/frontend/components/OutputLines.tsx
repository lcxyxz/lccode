import type { OutputSection as OutputSectionType } from '../../types/index.js'
import { OutputSection } from './OutputSection.js'
import type { TerminalMode } from '../useTerminal.js'

interface OutputLinesProps {
  sections: OutputSectionType[]
  focusedId?: number | null
  onToggleSection?: (id: number) => void
  mode: TerminalMode
}

/**
 * 输出行渲染组件
 * 渲染所有输出区块
 */
export function OutputLines({ sections, focusedId, onToggleSection, mode }: OutputLinesProps) {
  return (
    <>
      {sections.map((section) => (
        <OutputSection
          key={section.id}
          section={section}
          isFocused={section.id === focusedId}
          onToggle={onToggleSection}
          mode={mode}
        />
      ))}
    </>
  )
}