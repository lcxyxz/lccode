import { useState, useCallback, useRef } from 'react'
import type { OutputSection } from '../../types/index.js'

/**
 * 估算区块占用的行数
 * 考虑终端宽度的行换行
 */
function estimateLines(section: OutputSection, terminalWidth: number): number {
  if (section.collapsed) {
    return section.type === 'command' || section.type === 'thinking' ? 2 : 1
  }

  const lines = section.content.split('\n')
  let totalLines = 0

  for (const line of lines) {
    // 考虑在终端宽度处的换行（减去4字符的缩进和边距）
    const effectiveWidth = Math.max(terminalWidth - 4, 20)
    totalLines += Math.max(1, Math.ceil(line.length / effectiveWidth))
  }

  return 1 + totalLines + 1 // 标题行 + 内容行 + 间距
}

/**
 * 输出区块管理 Hook
 * 支持滚动偏移的视口管理，避免频繁重渲染
 * scrollOffset: 0 = 固定在底部, 正数 = 向上滚动 N 行
 */
export function useOutput(availableHeight: number) {
  const [sections, setSections] = useState<OutputSection[]>([
    { id: 0, type: 'message', title: '', content: 'Welcome to Terminal Assistant v0.1.0', collapsed: false, color: 'cyan' },
    { id: 1, type: 'message', title: '', content: 'Type "/help" to see available commands', collapsed: false, color: 'gray' },
  ])

  const idCounterRef = useRef(2)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const autoScrollRef = useRef(true) // 新内容到来时是否自动滚到底部
  const scrollOffsetRef = useRef(0) // ref 版偏移，避免闭包过期
  const maxScrollOffsetRef = useRef(0) // ref 版最大偏移

  const headerLines = 4
  const inputLines = 1
  const statusLines = 1
  const viewportHeight = Math.max(availableHeight - headerLines - inputLines - statusLines, 3)

  // 计算可见 sections
  const sectionMetrics = sections.map(s => ({
    id: s.id,
    startLine: 0,
    lines: estimateLines(s, process.stdout.columns || 80),
  }))
  let acc = 0
  for (const m of sectionMetrics) {
    m.startLine = acc
    acc += m.lines
  }
  const totalLines = acc

  const maxScrollOffset = Math.max(0, totalLines - viewportHeight)
  maxScrollOffsetRef.current = maxScrollOffset

  // 有效偏移：如果 autoScrollRef 为 true，强制为 0
  const effectiveOffset = autoScrollRef.current ? 0 : Math.min(scrollOffset, maxScrollOffset)
  const viewportStart = maxScrollOffset - effectiveOffset
  const viewportEnd = viewportStart + viewportHeight

  const visibleSections: OutputSection[] = []
  for (const section of sections) {
    const metric = sectionMetrics.find(m => m.id === section.id)!
    if (metric.startLine + metric.lines > viewportStart && metric.startLine < viewportEnd) {
      visibleSections.push(section)
    }
  }

  // ==================== 区块创建方法 ====================

  const addMessage = useCallback((content: string, color?: OutputSection['color']) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'message', title: '', content, collapsed: false, color,
    }])
    if (autoScrollRef.current) setScrollOffset(0)
  }, [])

  const addCommandResult = useCallback((command: string, output: string, success: boolean) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'command', title: `$ ${command}`,
      content: output || (success ? '(无输出)' : '(执行失败)'),
      collapsed: true, color: success ? 'green' : 'red',
    }])
    if (autoScrollRef.current) setScrollOffset(0)
  }, [])

  const addThinking = useCallback((content: string) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'thinking', title: '💭 思考过程',
      content, collapsed: true, color: 'gray',
    }])
    if (autoScrollRef.current) setScrollOffset(0)
  }, [])

  const addResponse = useCallback((content: string) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'response', title: '', content, collapsed: false, color: 'white',
    }])
    if (autoScrollRef.current) setScrollOffset(0)
  }, [])

  // ==================== 区块操作 ====================

  const toggleSection = useCallback((id: number) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, collapsed: !s.collapsed } : s
    ))
  }, [])

  const clearSections = useCallback(() => {
    setSections([])
    setFocusedId(null)
  }, [])

  const trimSections = useCallback((maxSections: number) => {
    setSections(prev => {
      if (prev.length <= maxSections) return prev
      return prev.slice(-maxSections)
    })
  }, [])

  // ==================== 滚动 ====================

  // 防止鼠标滚轮回弹：记录最后一次向下滚动到底部的时间戳
  const lastScrollToBottomTimeRef = useRef(0)
  const SCROLL_DEBOUNCE_MS = 150 // 150ms 内忽略向上滚动事件

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    scrollOffsetRef.current = 0
    setScrollOffset(0)
    setFocusedId(null)
  }, [])

  /** 向上滚动 N 行，并退出自动滚底模式（通过 ref 避免快速连续事件时闭包过期） */
  const scrollUp = useCallback(() => {
    // 如果刚刚滚到底部（150ms 内），忽略此次向上滚动，防止鼠标滚轮回弹
    if (
      scrollOffsetRef.current === 0 &&
      Date.now() - lastScrollToBottomTimeRef.current < SCROLL_DEBOUNCE_MS
    ) {
      return
    }
    autoScrollRef.current = false
    const next = Math.min(scrollOffsetRef.current + 3, maxScrollOffsetRef.current)
    scrollOffsetRef.current = next
    setScrollOffset(next)
  }, [])

  /** 向下滚动 N 行，如已到底部则恢复自动滚底（通过 ref 避免快速连续事件时闭包过期） */
  const scrollDown = useCallback(() => {
    const next = Math.max(scrollOffsetRef.current - 3, 0)
    scrollOffsetRef.current = next
    if (next === 0) {
      autoScrollRef.current = true
      lastScrollToBottomTimeRef.current = Date.now()
    }
    setScrollOffset(next)
  }, [])

  // ==================== 焦点导航 ====================

  const focusableSections = sections.filter(s => s.type === 'command' || s.type === 'thinking')

  const moveFocusUp = useCallback(() => {
    if (focusableSections.length === 0) return
    setFocusedId(prev => {
      if (prev === null) return focusableSections[focusableSections.length - 1].id
      const idx = focusableSections.findIndex(s => s.id === prev)
      if (idx <= 0) return focusableSections[focusableSections.length - 1].id
      return focusableSections[idx - 1].id
    })
  }, [focusableSections])

  const moveFocusDown = useCallback(() => {
    if (focusableSections.length === 0) return
    setFocusedId(prev => {
      if (prev === null) return focusableSections[0].id
      const idx = focusableSections.findIndex(s => s.id === prev)
      if (idx >= focusableSections.length - 1) return focusableSections[0].id
      return focusableSections[idx + 1].id
    })
  }, [focusableSections])

  const toggleFocused = useCallback(() => {
    if (focusedId !== null) toggleSection(focusedId)
  }, [focusedId, toggleSection])

  const clearFocus = useCallback(() => {
    setFocusedId(null)
  }, [])

  return {
    sections: visibleSections,
    focusedId,
    addMessage,
    addCommandResult,
    addThinking,
    addResponse,
    toggleSection,
    clearSections,
    trimSections,
    moveFocusUp,
    moveFocusDown,
    toggleFocused,
    clearFocus,
    scrollUp,
    scrollDown,
    scrollToBottom,
  }
}
