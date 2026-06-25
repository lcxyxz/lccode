import { useState, useEffect } from 'react'

/**
 * 终端窗口大小监听 Hook
 * 监听终端 resize 事件，返回可用高度
 */
export function useTerminalSize() {
  const [availableHeight, setAvailableHeight] = useState(process.stdout.rows || 24)

  useEffect(() => {
    const onResize = () => {
      setAvailableHeight(process.stdout.rows || 24)
    }
    process.stdout.on('resize', onResize)
    return () => {
      process.stdout.off('resize', onResize)
    }
  }, [])

  return availableHeight
}
