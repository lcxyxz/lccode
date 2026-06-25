import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { SLASH_COMMANDS } from '../commands.js'

/**
 * 斜杠命令提示 Hook
 * 管理斜杠命令的过滤、选择和显示状态
 */
export function useSlashCommands(initialInput: string) {
  const [input, setInput] = useState(initialInput)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(selectedIndex)

  selectedIndexRef.current = selectedIndex

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return []
    const query = input.slice(1).toLowerCase()
    return SLASH_COMMANDS.filter((cmd) => cmd.slice(1).toLowerCase().startsWith(query))
  }, [input])

  const filteredCommandsRef = useRef(filteredCommands)
  filteredCommandsRef.current = filteredCommands

  useEffect(() => {
    setSelectedIndex(0)
    if (input === '/') {
      setShowSuggestions(true)
    } else if (!input.startsWith('/')) {
      setShowSuggestions(false)
    }
  }, [input, filteredCommands.length])

  const updateInput = useCallback((newInput: string) => {
    setInput(newInput)
  }, [])

  const selectUp = useCallback(() => {
    setSelectedIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const selectDown = useCallback(() => {
    setSelectedIndex((prev) => {
      const len = filteredCommandsRef.current.length
      return Math.min(len - 1, prev + 1)
    })
  }, [])

  const getSelectedCommand = useCallback((): string | null => {
    return filteredCommandsRef.current[selectedIndexRef.current] || null
  }, [])

  return {
    showSuggestions,
    selectedIndex,
    filteredCommands,
    updateInput,
    selectUp,
    selectDown,
    getSelectedCommand,
  }
}
