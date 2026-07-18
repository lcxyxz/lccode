import { useState, useCallback, useRef } from 'react'
import type { OutputSection, CommandEntry, DiffLine } from '../../types/index.js'
import {getCurrentVersion} from '../../utils/version-checker.js'

const VERSION = getCurrentVersion()

export function useOutput() {
  const [sections, setSections] = useState<OutputSection[]>([
    { id: 0, type: 'message', title: '', content: `Welcome to lccode ${VERSION}`, collapsed: false, color: 'cyan' },
    { id: 1, type: 'message', title: '', content: 'Type "/help" to see available commands', collapsed: false, color: 'gray' },
  ])

  const idCounterRef = useRef(2)
  /** 当前正在构建的 response section id */
  const currentResponseIdRef = useRef<number | null>(null)

  const addMessage = useCallback((content: string, color?: OutputSection['color']) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'message', title: '', content: content ?? '', collapsed: false, color,
    }])
  }, [])

  const addCommandResult = useCallback((command: string, output: string, success: boolean) => {
    const entry: CommandEntry = { command, output, success }

    setSections(prev => {
      // 如果有当前正在构建的 response section，追加到其中
      if (currentResponseIdRef.current !== null) {
        return prev.map(s => {
          if (s.id === currentResponseIdRef.current) {
            return {
              ...s,
              commands: [...(s.commands ?? []), entry],
            }
          }
          return s
        })
      }
      // 否则创建一个临时的 command section
      const id = idCounterRef.current++
      return [...prev, {
        id, type: 'command', title: '', content: '',
        collapsed: false, color: success ? 'green' : 'red',
        commands: [entry],
      }]
    })
  }, [])

  const addResponse = useCallback((content: string) => {
    const id = idCounterRef.current++
    currentResponseIdRef.current = id
    setSections(prev => [...prev, {
      id, type: 'response', title: '', content: content ?? '', collapsed: false, color: 'white',
    }])
  }, [])

  const clearSections = useCallback(() => {
    currentResponseIdRef.current = null
    setSections([])
  }, [])

  const resetCommandList = useCallback(() => {
    currentResponseIdRef.current = null
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
