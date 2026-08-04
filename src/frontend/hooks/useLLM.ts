import { useState, useCallback, useRef } from 'react'
import type { Agent } from '../../agent/agent.js'
import type { LLMStatus, TokenUsage } from '../../types/index.js'

interface LLMOutputActions {
  addMessage: (content: string, color?: string) => void
  startQuery: () => void
  addRoundThinking: (round: number | undefined, content: string) => void
  addRoundCommand: (round: number | undefined, command: string, output: string, success: boolean) => void
  addRoundResponse: (round: number | undefined, content: string) => void
  addRoundDiff: (round: number | undefined, filePath: string, language: string, lines: any[]) => void
  onGitCommand?: () => void
}

export function useLLM(agentRef: React.RefObject<Agent | null>, actions: LLMOutputActions) {
  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  })

  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const callAgent = useCallback(async (query: string) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: LCCODE_API_KEY not set.', 'yellow')
      return
    }

    actionsRef.current.startQuery()
    setLlmStatus('loading')
    let cancelled = false

    try {
      for await (const event of agent.processInput(query)) {
        switch (event.type) {
          case 'thinking':
            actionsRef.current.addRoundThinking(event.metadata?.round, event.content ?? '')
            break
          case 'command':
            if (event.metadata) {
              const cmd = event.metadata.command ?? ''
              if (/git\s+(checkout|switch|branch)\b/.test(cmd)) {
                actionsRef.current.onGitCommand?.()
              }
              actionsRef.current.addRoundCommand(
                event.metadata.round,
                cmd,
                event.metadata.commandOutput ?? '',
                event.metadata.success ?? false,
              )
            }
            break
          case 'response':
            actionsRef.current.addRoundResponse(event.metadata?.round, event.content ?? '')
            break
          case 'error':
            if (event.content === '对话已取消') { cancelled = true }
            actionsRef.current.addMessage(event.content ?? 'Unknown error', 'yellow')
            break
          case 'token_usage':
            if (event.usage) {
              setTokenUsage(prev => ({
                promptTokens: prev.promptTokens + event.usage!.promptTokens,
                completionTokens: prev.completionTokens + event.usage!.completionTokens,
                totalTokens: prev.totalTokens + event.usage!.totalTokens,
              }))
            }
            break
          case 'diff_preview':
            if (event.diffPreview) {
              actionsRef.current.addRoundDiff(
                event.metadata?.round,
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
  }, [agentRef])

  return { callAgent, llmStatus, tokenUsage }
}
