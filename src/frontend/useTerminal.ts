import { useEffect, useCallback, useRef, useState } from 'react'
import { useInput } from 'ink'
import { useOutput } from './hooks/useOutput.js'
import { useCommandHistory } from './hooks/useCommandHistory.js'
import { useSlashCommands } from './hooks/useSlashCommands.js'
import { processCommand } from './commands.js'
import { Agent } from '../agent/agent.js'
import type { LLMStatus, TokenUsage } from '../types/index.js'
import { LogLevel } from '../utils/logger.js'

export function useTerminal(onExit?: () => void) {
  const {
    sections, addMessage, addCommandResult, addResponse, addDiffPreview,
    clearSections, resetCommandList,
  } = useOutput()
  const { addHistory, navigateUp } = useCommandHistory()
  const slash = useSlashCommands('')

  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')
  const [input, setInput] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  const agentRef = useRef<Agent | null>(null)
  const inputRef = useRef('')
  const llmStatusRef = useRef<LLMStatus>('idle')
  const confirmationPendingRef = useRef(false)

  inputRef.current = input

  // 同步llmStatus到ref
  llmStatusRef.current = llmStatus

  useEffect(() => {
    const apiKey = process.env.LCCODE_API_KEY
    if (apiKey) {
      Agent.create(
        {
          apiKey,
          baseUrl: process.env.LCCODE_BASE_URL,
          model: process.env.LCCODE_MODEL,
          provider: process.env.LCCODE_PROVIDER as any,
        },
        { level: LogLevel.DEBUG }
      ).then(agent => {
        agentRef.current = agent
      })
    }
  }, [])

  const actionsRef = useRef({
    addMessage,
    addCommandResult,
    addResponse,
    addDiffPreview,
    addHistory,
    clearSections,
    resetCommandList,
  })

  actionsRef.current = {
    addMessage,
    addCommandResult,
    addResponse,
    addDiffPreview,
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

  const cancelAgent = useCallback(() => {
    agentRef.current?.cancel()
  }, [])

  const handleMcpAction = useCallback((args: string[]) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: Agent not initialized.', 'yellow')
      return
    }

    const mcpManager = agent.getMcpManager()
    const subcmd = args[0]?.toLowerCase()

    if (!subcmd || subcmd === 'list' || subcmd === 'status') {
      const servers = mcpManager.getServerBriefList()
      if (servers.length === 0) {
        actionsRef.current.addMessage('No MCP servers configured.', 'yellow')
        return
      }

      let output = 'MCP Servers:\n────────────\n'
      servers.forEach((s, i) => {
        const status = s.activeToolCount === s.toolCount ? '✅' :
          s.activeToolCount > 0 ? '🟡' : '❌'
        const conn = s.connected ? '●' : '○'
        output += `  ${i + 1}. ${status} [${conn}] ${s.name} (${s.activeToolCount}/${s.toolCount} tools)\n`
      })
      output += '\nUsage:\n'
      output += '  /mcp           - Show this list\n'
      output += '  /mcp 1,2       - Toggle servers by number\n'
      output += '  /mcp all       - Enable all servers\n'
      output += '  /mcp none      - Disable all servers\n'

      actionsRef.current.addMessage(output, 'cyan')
      return
    }

    if (subcmd === 'all') {
      mcpManager.enableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers enabled.', 'green')
      return
    }

    if (subcmd === 'none') {
      mcpManager.disableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers disabled.', 'yellow')
      return
    }

    const numbers = args.join(',').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    if (numbers.length === 0) {
      actionsRef.current.addMessage('Invalid usage. See /mcp for help.', 'yellow')
      return
    }

    const results: string[] = []
    for (const num of numbers) {
      const result = mcpManager.toggleServerByIndex(num - 1)
      if (result) {
        results.push(`${result.server} → ${result.enabled ? 'enabled' : 'disabled'} (${result.toolCount} tools)`)
      } else {
        results.push(`#${num}: invalid server number`)
      }
    }
    agent.refreshToolFilter()
    actionsRef.current.addMessage(results.join('\n'), 'cyan')
  }, [])

  const callAgent = useCallback(async (query: string) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: LCCODE_API_KEY not set.', 'yellow')
      return
    }

    actionsRef.current.resetCommandList()
    setLlmStatus('loading')

    let cancelled = false

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
            if (event.content === '对话已取消') {
              cancelled = true
            }
            actionsRef.current.addMessage(event.content ?? 'Unknown error', 'yellow')
            break
          case 'confirmation_request':
            confirmationPendingRef.current = true
            actionsRef.current.addMessage(`⚠ 危险命令需要确认: ${event.content}\n输入 y 确认，其他任意键取消`, 'yellow')
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
          case 'diff_preview':
            if (event.diffPreview) {
              actionsRef.current.addDiffPreview(
                event.diffPreview.filePath,
                event.diffPreview.language,
                event.diffPreview.lines,
              )
            }
            break
        }
      }

      setLlmStatus(cancelled ? 'idle' : 'done')
    } catch (error: any) {
      actionsRef.current.addMessage(`LLM Error: ${error?.message || 'Unknown error'}`, 'yellow')
      setLlmStatus('error')
    }
  }, [])

  const handleSubmit = useCallback((line: string) => {
    if (showSuggestionsRef.current) return
    if (!line.trim()) return

    // 危险命令确认处理
    if (confirmationPendingRef.current) {
      confirmationPendingRef.current = false
      const answer = line.trim().toLowerCase()
      if (answer === 'y' || answer === 'yes') {
        agentRef.current?.respondToConfirmation(true)
      } else {
        agentRef.current?.respondToConfirmation(false)
      }
      setInput('')
      return
    }

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
    } else if (action.type === 'MCP_ACTION') {
      handleMcpAction(action.args)
    }
  }, [callAgent, cancelAgent])

  const handleChange = useCallback((value: string) => {
    setInput(value)
  }, [])

  useInput((char, key) => {
    // 处理Ctrl+C
    if (key.ctrl && char === 'c') {
      handleCtrlC()
      return
    }

    // 处理Escape键 - 取消对话
    if (key.escape) {
      // 如果正在加载，取消对话
      if (llmStatusRef.current === 'loading') {
        cancelAgent()
        return
      }
      // 如果斜杠建议显示，关闭建议
      if (slashRef.current.showSuggestions) {
        slashRef.current.dismiss()
        return
      }
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
    cancelAgent,
    showSuggestions: slash.showSuggestions,
    filteredCommands: slash.filteredCommands,
    selectedIndex: slash.selectedIndex,
  }
}
