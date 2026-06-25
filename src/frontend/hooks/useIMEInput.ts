import { useInput } from 'ink'
import { useCallback, useRef, useState } from 'react'

export interface UseIMEInputOptions {
  onSubmit: (line: string) => void
  onCtrlC?: () => void
  onCtrlL?: () => void
  onEscape?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onTab?: () => void
  onEnter?: (line: string) => boolean
  onSpace?: (line: string) => boolean
  onInput?: () => void
}

/**
 * IME 兼容输入 Hook
 * 使用 Ink 内置的 useInput（它内部正确管理 raw mode，不会干扰鼠标滚轮终端滚动）
 */
export function useIMEInput({ onSubmit, onCtrlC, onCtrlL, onEscape, onArrowUp, onArrowDown, onTab, onEnter, onSpace, onInput }: UseIMEInputOptions) {
  const [input, setInput] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input

  const submit = useCallback(() => {
    const line = inputRef.current
    onSubmit(line)
    setInput('')
  }, [onSubmit])

  const setInputValue = useCallback((value: string) => {
    setInput(value)
  }, [])

  useInput((char, key) => {
    // Ctrl+C
    if (key.ctrl && char === 'c') {
      onCtrlC?.()
      return
    }

    // Ctrl+L
    if (key.ctrl && char === 'l') {
      onCtrlL?.()
      return
    }

    // Escape
    if (key.escape) {
      onEscape?.()
      return
    }

    // Enter
    if (key.return) {
      const line = inputRef.current
      if (onEnter?.(line)) return
      submit()
      return
    }

    // Tab
    if (key.tab) {
      onTab?.()
      return
    }

    // Arrow Up
    if (key.upArrow) {
      onArrowUp?.()
      return
    }

    // Arrow Down
    if (key.downArrow) {
      onArrowDown?.()
      return
    }

    // Space
    if (char === ' ') {
      const line = inputRef.current
      if (onSpace?.(line)) return
      setInput(prev => prev + ' ')
      onInput?.()
      return
    }

    // Backspace
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1))
      onInput?.()
      return
    }

    // 普通可打印字符（包括中文等多字节 UTF-8 字符）
    if (char && !key.meta && !key.ctrl && !key.upArrow && !key.downArrow && !key.tab && !key.return && !key.escape) {
      setInput(prev => prev + char)
      onInput?.()
    }
  })

  return { input, setInputValue, isComposing: false }
}
