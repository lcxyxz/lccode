import { useState, useCallback, useEffect, useRef } from 'react'
import type { Agent } from '../../agent/agent.js'

export function useExit(onExit?: () => void, agentRef?: React.RefObject<Agent | null>) {
  const [isExiting, setIsExiting] = useState(false)

  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const triggerExit = useCallback(() => {
    setIsExiting(true)
    agentRef?.current?.disconnect?.()
  }, [agentRef])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        onExitRef.current?.()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isExiting])

  return { isExiting, triggerExit }
}
