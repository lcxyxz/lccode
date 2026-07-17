import { useEffect, useRef, useCallback } from 'react'
import { Agent } from '../../agent/agent.js'
import { LogLevel } from '../../utils/logger.js'

export function useAgent() {
  const agentRef = useRef<Agent | null>(null)

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
      ).then(agent => { agentRef.current = agent })
    }
  }, [])

  const cancel = useCallback(() => {
    agentRef.current?.cancel()
  }, [])

  return { agentRef, cancel }
}
