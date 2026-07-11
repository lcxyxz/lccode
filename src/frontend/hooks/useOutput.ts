import { useState, useCallback, useRef } from 'react'
import type { OutputSection, DiffLine } from '../../types/index.js'

export function useOutput() {
  const [sections, setSections] = useState<OutputSection[]>([
    { id: 0, type: 'message', title: '', content: 'Welcome to lccode v0.0.4', collapsed: false, color: 'cyan' },
    { id: 1, type: 'message', title: '', content: 'Type "/help" to see available commands', collapsed: false, color: 'gray' },
  ])

  const idCounterRef = useRef(2)
  const commandListIdRef = useRef<number | null>(null)
  const commandEntriesRef = useRef<Array<{ command: string; success: boolean }>>([])

  const addMessage = useCallback((content: string, color?: OutputSection['color']) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'message', title: '', content: content ?? '', collapsed: false, color,
    }])
  }, [])

  const addCommandResult = useCallback((command: string, _output: string, success: boolean) => {
    commandEntriesRef.current.push({ command, success })
    const lines = commandEntriesRef.current
      .map(e => `$ ${e.command}`)
      .join('\n')
    const allSuccess = commandEntriesRef.current.every(e => e.success)

    setSections(prev => {
      // 移除旧的命令列表 section
      const filtered = commandListIdRef.current !== null
        ? prev.filter(s => s.id !== commandListIdRef.current)
        : prev
      // 创建新的命令列表 section
      const id = commandListIdRef.current ?? idCounterRef.current++
      commandListIdRef.current = id
      return [...filtered, {
        id, type: 'command', title: '',
        content: lines,
        collapsed: false, color: allSuccess ? 'green' : 'red',
      }]
    })
  }, [])

  const addResponse = useCallback((content: string) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'response', title: '', content: content ?? '', collapsed: false, color: 'white',
    }])
  }, [])

  const clearSections = useCallback(() => {
    commandListIdRef.current = null
    commandEntriesRef.current = []
    setSections([])
  }, [])

  const resetCommandList = useCallback(() => {
    const oldId = commandListIdRef.current
    commandListIdRef.current = null
    commandEntriesRef.current = []
    if (oldId !== null) {
      setSections(prev => prev.filter(s => s.id !== oldId))
    }
  }, [])

  const addDiffPreview = useCallback((filePath: string, language: string, lines: DiffLine[]) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'diff_preview', title: filePath,
      content: '', collapsed: false, color: 'white',
      diffPreview: { filePath, language, lines },
    }])
  }, [])

  return {
    sections,
    addMessage,
    addCommandResult,
    addResponse,
    addDiffPreview,
    clearSections,
    resetCommandList,
  }
}
