import { Box } from 'ink'
import { useTerminal } from './frontend/useTerminal.js'
import { Header } from './frontend/components/Header.js'
import { OutputLines } from './frontend/components/OutputLines.js'
import { InputLine } from './frontend/components/InputLine.js'
import { CommandSuggestion } from './frontend/components/CommandSuggestion.js'
import { StatusLine } from './frontend/components/StatusLine.js'

/**
 * 主应用组件
 */
function App({ onExit }: { onExit?: () => void }) {
  const {
    sections, focusedId, input, cursorVisible,
    mode, showSuggestions, filteredCommands, selectedIndex,
    llmStatus, toggleSection,
  } = useTerminal(onExit)

  return (
    <Box flexDirection="column" height="100%">
      <Header llmStatus={llmStatus} mode={mode} />
      <Box flexDirection="column" flexGrow={1}>
        <OutputLines sections={sections} focusedId={focusedId} onToggleSection={toggleSection} mode={mode} />
      </Box>
      {showSuggestions && filteredCommands.length > 0 && mode === 'insert' && (
        <CommandSuggestion commands={filteredCommands} selectedIndex={selectedIndex} />
      )}
      {mode === 'insert' && (
        <InputLine
          input={input}
          cursorVisible={cursorVisible}
          llmStatus={llmStatus}
        />
      )}
      <StatusLine llmStatus={llmStatus} mode={mode} modelName={process.env.DEEPSEEK_MODEL || 'AI'} />
    </Box>
  )
}

export default App
