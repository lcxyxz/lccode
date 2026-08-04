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
  /** 最近一个轮次卡片（round 编号 → 卡片 id），用于事件按轮聚合 */
  const lastRoundRef = useRef<{ round: number; id: number } | null>(null)
  /** 详情模式是否开启（Tab 切换，控制所有卡片思考/执行结果的展开） */
  const [showDetails, setShowDetails] = useState(false)

  const addMessage = useCallback((content: string, color?: OutputSection['color']) => {
    const id = idCounterRef.current++
    setSections(prev => [...prev, {
      id, type: 'message', title: '', content: content ?? '', collapsed: false, color,
    }])
  }, [])

  /** 确保指定轮次的卡片存在，返回卡片 id */
  const ensureRoundCard = useCallback((round: number): number => {
    if (lastRoundRef.current && lastRoundRef.current.round === round) {
      return lastRoundRef.current.id
    }
    const id = idCounterRef.current++
    lastRoundRef.current = { round, id }
    setSections(prev => [...prev, {
      id, type: 'round', title: '', content: '', collapsed: false, color: 'white',
      round, commands: [],
    }])
    return id
  }, [])

  const updateCard = useCallback((id: number, updater: (s: OutputSection) => OutputSection) => {
    setSections(prev => prev.map(s => (s.id === id ? updater(s) : s)))
  }, [])

  const addRoundThinking = useCallback((round: number | undefined, content: string) => {
    if (round === undefined || !content) return
    const id = ensureRoundCard(round)
    updateCard(id, s => ({ ...s, thinking: content }))
  }, [ensureRoundCard, updateCard])

  const addRoundCommand = useCallback((round: number | undefined, command: string, output: string, success: boolean) => {
    if (round === undefined) return
    const id = ensureRoundCard(round)
    const entry: CommandEntry = { command, output, success }
    updateCard(id, s => ({ ...s, commands: [...(s.commands ?? []), entry] }))
  }, [ensureRoundCard, updateCard])

  const addRoundDiff = useCallback((round: number | undefined, filePath: string, language: string, lines: DiffLine[]) => {
    if (round === undefined) return
    const id = ensureRoundCard(round)
    updateCard(id, s => ({ ...s, diffPreview: { filePath, language, lines } }))
  }, [ensureRoundCard, updateCard])

  const addRoundResponse = useCallback((round: number | undefined, content: string) => {
    if (!content) return
    if (round === undefined) {
      // 无轮次信息（如达到最大轮次兜底），作为独立消息显示
      addMessage(content, 'yellow')
      return
    }
    const id = ensureRoundCard(round)
    updateCard(id, s => ({ ...s, content: s.content ? `${s.content}\n\n${content}` : content }))
  }, [addMessage, ensureRoundCard, updateCard])

  /** 新查询开始：重置轮次聚合，旧卡片保留为历史 */
  const startQuery = useCallback(() => {
    lastRoundRef.current = null
  }, [])

  const clearSections = useCallback(() => {
    lastRoundRef.current = null
    setSections(prev => prev.filter(s => s.id < 2))
  }, [])

  const toggleDetails = useCallback(() => {
    setShowDetails(v => !v)
  }, [])

  return {
    sections,
    addMessage,
    addRoundThinking,
    addRoundCommand,
    addRoundResponse,
    addRoundDiff,
    startQuery,
    clearSections,
    showDetails,
    toggleDetails,
  }
}
