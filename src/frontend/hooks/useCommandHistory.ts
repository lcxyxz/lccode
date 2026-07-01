import { useState, useCallback, useRef } from 'react'

/**
 * 命令历史管理 Hook
 * 管理命令历史记录和历史导航
 */
export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const historyRef = useRef(history)
  const historyIdxRef = useRef(historyIdx)

  historyRef.current = history
  historyIdxRef.current = historyIdx

  const addHistory = useCallback((cmd: string) => {
    setHistory((prev) => [...prev, cmd])
    setHistoryIdx(-1)
  }, [])

  const navigateUp = useCallback((): string | null => {
    const h = historyRef.current
    if (h.length === 0) return null
    const newIdx = historyIdxRef.current === -1
      ? h.length - 1
      : Math.max(0, historyIdxRef.current - 1)
    setHistoryIdx(newIdx)
    return h[newIdx]
  }, [])

  return { addHistory, navigateUp }
}
