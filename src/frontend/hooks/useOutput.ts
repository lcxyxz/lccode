import { useState, useCallback, useRef } from 'react'
import type { OutputSection } from '../../types/index.js'

export function useOutput() {
  const [sections, setSections] = useState<OutputSection[]>([
    { id: 0, type: 'message', title: '', content: 'Welcome to Terminal Assistant v0.1.0', collapsed: false, color: 'cyan' },
    { id: 1, type: 'message', title: '', content: 'Type "/help" to see available commands', collapsed: false, color: 'gray' },
  ])

  const idCounterRef = useRef(2)

  const addMessage = useCallback((content: string, color?: OutputSection['color']) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'message', title: '', content: content ?? '', collapsed: false, color,
    }])
  }, [])

  const addCommandResult = useCallback((command: string, _output: string, success: boolean) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'command', title: '',
      content: `$ ${command ?? ''}`,
      collapsed: false, color: success ? 'green' : 'red',
    }])
  }, [])

  const addResponse = useCallback((content: string) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'response', title: '', content: content ?? '', collapsed: false, color: 'white',
    }])
  }, [])

  const clearSections = useCallback(() => {
    setSections([])
  }, [])

  const trimSections = useCallback((maxSections: number) => {
    setSections(prev => {
      if (prev.length <= maxSections) return prev
      return prev.slice(-maxSections)
    })
  }, [])

  return {
    sections,
    addMessage,
    addCommandResult,
    addResponse,
    clearSections,
    trimSections,
  }
}
