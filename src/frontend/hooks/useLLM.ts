import { useState, useCallback, useRef } from 'react'
import type { Agent } from '../../agent/agent.js'
import type { LLMStatus, TokenUsage } from '../../types/index.js'

interface LLMOutputActions {
  addMessage: (content: string, color?: string) => void
  addCommandResult: (command: string, output: string, success: boolean) => void
  addResponse: (content: string) => void
  addDiffPreview: (filePath: string, language: string, lines: any[]) => void
  resetCommandList: () => void
  onGitCommand?: () => void
}

export function useLLM(agentRef: React.RefObject<Agent | null>, actions: LLMOutputActions) {
  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  })

  /** 使用 Ref 同步追踪 token 使用量，确保退出时能获取最新值 */
  const tokenUsageRef = useRef<TokenUsage>({
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
              const cmd = event.metadata.command ?? ''
              if (/git\s+(checkout|switch|branch)\b/.test(cmd)) {
                actionsRef.current.onGitCommand?.()
              }
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
            if (event.content === '对话已取消') { cancelled = true }
            actionsRef.current.addMessage(event.content ?? 'Unknown error', 'yellow')
            break
          case 'token_usage':
            if (event.usage) {
              // 更新 Ref（同步，立即生效）
              tokenUsageRef.current = {
                promptTokens: tokenUsageRef.current.promptTokens + event.usage.promptTokens,
                completionTokens: tokenUsageRef.current.completionTokens + event.usage.completionTokens,
                totalTokens: tokenUsageRef.current.totalTokens + event.usage.totalTokens,
              }
              // 更新 State（异步，用于 UI 显示）
              setTokenUsage({ ...tokenUsageRef.current })
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
  }, [agentRef])

  return { callAgent, llmStatus, tokenUsage, tokenUsageRef }
}
