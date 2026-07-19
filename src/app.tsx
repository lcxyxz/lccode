import { Box, Text } from 'ink'
import { Component, type ReactNode } from 'react'
import { useTerminal } from './frontend/useTerminal.js'
import { Header } from './frontend/components/Header.js'
import { OutputLines } from './frontend/components/OutputLines.js'
import { InputLine } from './frontend/components/InputLine.js'
import { CommandSuggestion } from './frontend/components/CommandSuggestion.js'
import { FileSuggestion } from './frontend/components/FileSuggestion.js'
import { StatusLine } from './frontend/components/StatusLine.js'
import { InfoLine } from './frontend/components/InfoLine.js'
import { ExitScreen } from './frontend/components/ExitScreen.js'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || 'Unknown error' }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column">
          <Header />
          <Box flexDirection="column" marginBottom={1}>
            <Text color="red">Error: {this.state.error}</Text>
            <Text color="gray">Restart the application.</Text>
          </Box>
        </Box>
      )
    }
    return this.props.children
  }
}

function AppContent({ onExit }: { onExit?: () => void }) {
  const {
    sections, input, llmStatus, tokenUsage, handleSubmit, handleChange, cancelAgent,
    showSuggestions, filteredCommands, selectedIndex,
    showFileSuggestions, filteredFiles, fileSelectedIndex,
    isExiting, branchVersion,
  } = useTerminal(onExit)

  if (isExiting) {
    return <ExitScreen />
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexDirection="column" flexGrow={1}>
        <OutputLines sections={sections} />
      </Box>
      {showSuggestions && filteredCommands.length > 0 && (
        <CommandSuggestion commands={filteredCommands} selectedIndex={selectedIndex} />
      )}
      {showFileSuggestions && filteredFiles.length > 0 && (
        <FileSuggestion files={filteredFiles} selectedIndex={fileSelectedIndex} />
      )}
      <InputLine
        value={input}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={cancelAgent}
        llmStatus={llmStatus}
      />
      <StatusLine llmStatus={llmStatus} modelName={process.env.LCCODE_MODEL || 'AI'} tokenUsage={tokenUsage} />
      <InfoLine branchVersion={branchVersion} />
    </Box>
  )
}

function App({ onExit }: { onExit?: () => void }) {
  return (
    <ErrorBoundary>
      <AppContent onExit={onExit} />
    </ErrorBoundary>
  )
}

export default App
