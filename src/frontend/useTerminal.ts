import { useEffect, useCallback, useRef, useState } from 'react'
import { useCursor } from './hooks/useCursor.js'
import { useTerminalSize } from './hooks/useTerminalSize.js'
import { useOutput } from './hooks/useOutput.js'
import { useCommandHistory } from './hooks/useCommandHistory.js'
import { useIMEInput } from './hooks/useIMEInput.js'
import { useSlashCommands } from './hooks/useSlashCommands.js'
import { processCommand } from './commands.js'
import { Agent } from '../agent/agent.js'
import type { LLMStatus, OutputSection } from '../types/index.js'

/**
 * 终端模式
 * insert: 输入模式，可以输入文本
 * visual: 可视化模式，可以选择和操作区块
 */
export type TerminalMode = 'insert' | 'visual'

/**
 * 终端操作接口
 * 将所有操作方法分组到单个对象中，避免 useRef 反模式
 */
interface TerminalActions {
  addMessage: (content: string, color?: OutputSection['color']) => void
  addCommandResult: (cmd: string, output: string, success: boolean) => void
  addThinking: (content: string) => void
  addResponse: (content: string) => void
  addHistory: (cmd: string) => void
  clearSections: () => void
  toggleSection: (id: number) => void
  toggleFocused: () => void
  clearFocus: () => void
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
  moveFocusUp: () => void
  moveFocusDown: () => void
}

export function useTerminal(onExit?: () => void) {
  const cursorVisible = useCursor()
  const availableHeight = useTerminalSize()
  const {
    sections, focusedId, addMessage, addCommandResult, addThinking,
    addResponse, toggleSection, clearSections, trimSections,
    toggleFocused, clearFocus,
    scrollUp, scrollDown, scrollToBottom,
    moveFocusUp, moveFocusDown,
  } = useOutput(availableHeight)
  const { addHistory, navigateUp, navigateDown } = useCommandHistory()
  const slash = useSlashCommands('')

  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')
  const [mode, setMode] = useState<TerminalMode>('insert')
  const agentRef = useRef<Agent | null>(null)

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

  // 将所有操作方法分组到单个 ref 中
  const actionsRef = useRef<TerminalActions>({
    addMessage,
    addCommandResult,
    addThinking,
    addResponse,
    addHistory,
    clearSections,
    toggleSection,
    toggleFocused,
    clearFocus,
    scrollUp,
    scrollDown,
    scrollToBottom,
    moveFocusUp,
    moveFocusDown,
  })

  // 更新 actions ref
  actionsRef.current = {
    addMessage,
    addCommandResult,
    addThinking,
    addResponse,
    addHistory,
    clearSections,
    toggleSection,
    toggleFocused,
    clearFocus,
    scrollUp,
    scrollDown,
    scrollToBottom,
    moveFocusUp,
    moveFocusDown,
  }

  const slashRef = useRef(slash)
  slashRef.current = slash

  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const setInputValueRef = useRef<(value: string) => void>(() => {})

  const inputRef = useRef('')

  const focusedIdRef = useRef(focusedId)
  focusedIdRef.current = focusedId

  const modeRef = useRef(mode)
  modeRef.current = mode

  const handleCtrlC = useCallback(() => {
    actionsRef.current.addMessage('Goodbye!', 'cyan')
    onExitRef.current?.()
  }, [])

  const callAgent = useCallback(async (query: string) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: DEEPSEEK_API_KEY not set. Set it in environment.', 'yellow')
      setLlmStatus('idle')
      return
    }

    setLlmStatus('loading')

    try {
      for await (const event of agent.processInput(query)) {
        switch (event.type) {
          case 'thinking':
            actionsRef.current.addThinking(event.content)
            break
          case 'command':
            if (event.metadata) {
              actionsRef.current.addCommandResult(
                event.metadata.command || '',
                event.metadata.commandOutput || '',
                event.metadata.success ?? false,
              )
            }
            break
          case 'response':
            actionsRef.current.addResponse(event.content)
            break
          case 'error':
            actionsRef.current.addMessage(event.content, 'yellow')
            break
        }
      }

      trimSections(50)
      setLlmStatus('done')
    } catch (error: any) {
      const msg = error?.message || 'Unknown error'
      actionsRef.current.addMessage(`LLM Error: ${msg}`, 'yellow')
      setLlmStatus('error')
    }
  }, [])

  const { input, setInputValue } = useIMEInput({
    onSubmit: useCallback((line: string) => {
      actionsRef.current.clearFocus()
      const action = processCommand(line, {
        addLine: actionsRef.current.addMessage,
        addHistory: actionsRef.current.addHistory,
        clearSections: actionsRef.current.clearSections,
      })
      if (action.type === 'EXIT') {
        onExitRef.current?.()
      } else if (action.type === 'LLM_QUERY') {
        callAgent(action.query)
      }
    }, [callAgent]),
    onCtrlC: handleCtrlC,
    onCtrlL: useCallback(() => {
      actionsRef.current.clearSections()
      actionsRef.current.scrollToBottom()
    }, []),
    onEscape: useCallback(() => {
      setMode(prev => {
        const newMode = prev === 'insert' ? 'visual' : 'insert'
        // 切换到可视化模式时，如果没有焦点，移动到第一个可聚焦区块
        if (newMode === 'visual' && focusedIdRef.current === null) {
          actionsRef.current.moveFocusDown()
        }
        // 切换到输入模式时，清除焦点
        if (newMode === 'insert') {
          actionsRef.current.clearFocus()
        }
        return newMode
      })
    }, []),
    onArrowUp: useCallback(() => {
      if (modeRef.current === 'visual') {
        // 可视化模式：移动焦点
        actionsRef.current.moveFocusUp()
      } else if (slashRef.current.showSuggestions) {
        slashRef.current.selectUp()
      } else if (inputRef.current === '' || focusedIdRef.current === null) {
        const histCmd = navigateUp()
        if (histCmd !== null) {
          setInputValueRef.current(histCmd)
        }
      } else {
        actionsRef.current.scrollUp()
      }
    }, []),
    onArrowDown: useCallback(() => {
      if (modeRef.current === 'visual') {
        // 可视化模式：移动焦点
        actionsRef.current.moveFocusDown()
      } else if (slashRef.current.showSuggestions) {
        slashRef.current.selectDown()
      } else {
        const histCmd = navigateDown()
        if (histCmd !== null) {
          setInputValueRef.current(histCmd)
        } else {
          actionsRef.current.scrollDown()
        }
      }
    }, []),
    onEnter: useCallback((line: string): boolean => {
      // 可视化模式：切换展开/折叠
      if (modeRef.current === 'visual' && focusedIdRef.current !== null) {
        actionsRef.current.toggleFocused()
        return true
      }

      // 输入模式：处理斜杠命令
      const s = slashRef.current
      if (s.showSuggestions && s.filteredCommands.length > 0) {
        const cmd = s.getSelectedCommand()
        if (cmd && cmd !== line) {
          setInputValueRef.current(cmd)
          return true
        }
      }

      return false
    }, []),
    onSpace: useCallback((line: string): boolean => {
      // 可视化模式：切换展开/折叠
      if (modeRef.current === 'visual' && focusedIdRef.current !== null) {
        actionsRef.current.toggleFocused()
        return true
      }
      return false
    }, []),
    onTab: useCallback(() => {
      const s = slashRef.current
      if (!s.showSuggestions) return
      const cmd = s.getSelectedCommand()
      if (cmd) setInputValueRef.current(cmd)
    }, []),
    onInput: useCallback(() => {
      // 输入模式下才清除焦点
      if (modeRef.current === 'insert') {
        actionsRef.current.clearFocus()
      }
    }, []),
  })

  setInputValueRef.current = setInputValue
  inputRef.current = input

  useEffect(() => {
    slashRef.current.updateInput(input)
  }, [input])

  return {
    sections,
    focusedId,
    input,
    cursorVisible,
    mode,
    showSuggestions: slash.showSuggestions,
    filteredCommands: slash.filteredCommands,
    selectedIndex: slash.selectedIndex,
    llmStatus,
    toggleSection,
  }
}