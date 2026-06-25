import { useState, useEffect } from 'react'

/**
 * 光标闪烁 Hook
 * 每 500ms 切换光标可见性
 */
export function useCursor() {
  const [cursorVisible, setCursorVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((v) => !v)
    }, 500)
    return () => clearInterval(timer)
  }, [])

  return cursorVisible
}
