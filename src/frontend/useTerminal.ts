import { useEffect, useCallback, useRef, useState } from 'react'
import { useInput } from 'ink'
import { useOutput } from './hooks/useOutput.js'
import { useCommandHistory } from './hooks/useCommandHistory.js'
import { useSlashCommands } from './hooks/useSlashCommands.js'
import { processCommand } from './commands.js'
import { Agent } from '../agent/agent.js'
import type { LLMStatus, TokenUsage } from '../types/index.js'

export function useTerminal(onExit?: () => void) {
  const {
    sections, addMessage, addCommandResult, addResponse, addCodePreview,
    clearSections, resetCommandList,
  } = useOutput()
  const { addHistory, navigateUp } = useCommandHistory()
  const slash = useSlashCommands('')

  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')
  const [input, setInput] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  const agentRef = useRef<Agent | null>(null)
  const inputRef = useRef('')

  inputRef.current = input

  useEffect(() => {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (apiKey) {
      agentRef.current = new Agent({
        apiKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL,
        model: process.env.DEEPSEEK_MODEL,
      })
    }
  }, [])

  const actionsRef = useRef({
    addMessage,
    addCommandResult,
    addResponse,
    addCodePreview,
    addHistory,
    clearSections,
    resetCommandList,
  })

  actionsRef.current = {
    addMessage,
    addCommandResult,
    addResponse,
    addCodePreview,
    addHistory,
    clearSections,
    resetCommandList,
  }

  const slashRef = useRef(slash)
  slashRef.current = slash

  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const setInputValueRef = useRef<(value: string) => void>(() => {})
  const showSuggestionsRef = useRef(false)
  showSuggestionsRef.current = slash.showSuggestions

  const handleCtrlC = useCallback(() => {
    actionsRef.current.addMessage('Goodbye!', 'cyan')
    onExitRef.current?.()
  }, [])

  const callAgent = useCallback(async (query: string) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: DEEPSEEK_API_KEY not set.', 'yellow')
      return
    }

    actionsRef.current.resetCommandList()
    setLlmStatus('loading')

    try {
      for await (const event of agent.processInput(query)) {
        switch (event.type) {
          case 'thinking':
            break
          case 'command':
            if (event.metadata) {
              actionsRef.current.addCommandResult(
                event.metadata.command ?? '',
                event.metadata.commandOutput ?? '',
                event.metadata.success ?? false,
              )
            }
            break
          case 'response':
            actionsRef.current.addResponse(event.content ?? '')
            break
          case 'error':
            actionsRef.current.addMessage(event.content ?? 'Unknown error', 'yellow')
            break
          case 'token_usage':
            if (event.usage) {
              setTokenUsage((prev) => ({
                promptTokens: prev.promptTokens + event.usage!.promptTokens,
                completionTokens: prev.completionTokens + event.usage!.completionTokens,
                totalTokens: prev.totalTokens + event.usage!.totalTokens,
              }))
            }
            break
          case 'code_preview':
            if (event.codePreview) {
              actionsRef.current.addCodePreview(
                event.codePreview.filePath,
                event.codePreview.language,
                event.codePreview.content,
              )
            }
            break
        }
      }

      setLlmStatus('done')
    } catch (error: any) {
      const msg = error?.message || 'Unknown error'
      actionsRef.current.addMessage(`LLM Error: ${msg}`, 'yellow')
      setLlmStatus('error')
    }
  }, [])

  const handleSubmit = useCallback((line: string) => {
    if (showSuggestionsRef.current) return
    if (!line.trim()) return

    const action = processCommand(line, {
      addLine: actionsRef.current.addMessage,
      addHistory: actionsRef.current.addHistory,
      clearSections: actionsRef.current.clearSections,
    })

    setInput('')

    if (action.type === 'EXIT') {
      onExitRef.current?.()
    } else if (action.type === 'LLM_QUERY') {
      callAgent(action.query)
    }
  }, [callAgent])

  const handleChange = useCallback((value: string) => {
    setInput(value)
  }, [])

  useInput((char, key) => {
    if (key.ctrl && char === 'c') {
      handleCtrlC()
      return
    }

    if (key.upArrow && slashRef.current.showSuggestions) {
      slashRef.current.selectUp()
      return
    }

    if (key.downArrow && slashRef.current.showSuggestions) {
      slashRef.current.selectDown()
      return
    }

    if (key.tab && slashRef.current.showSuggestions) {
      const cmd = slashRef.current.getSelectedCommand()
      if (cmd) {
        setInputValueRef.current(cmd)
      }
      return
    }

    if (key.return && slashRef.current.showSuggestions) {
      const cmd = slashRef.current.getSelectedCommand()
      if (cmd) {
        setInputValueRef.current(cmd)
      }
      slashRef.current.dismiss()
      return
    }

    if (key.escape && slashRef.current.showSuggestions) {
      slashRef.current.dismiss()
      return
    }

    if (key.upArrow && inputRef.current === '') {
      const histCmd = navigateUp()
      if (histCmd !== null) {
        setInputValueRef.current(histCmd)
      }
      return
    }
  })

  setInputValueRef.current = setInput

  useEffect(() => {
    slashRef.current.updateInput(input)
  }, [input])

  return {
    sections,
    input,
    llmStatus,
    tokenUsage,
    handleSubmit,
    handleChange,
    showSuggestions: slash.showSuggestions,
    filteredCommands: slash.filteredCommands,
    selectedIndex: slash.selectedIndex,
  }
}
