import { useEffect, useCallback, useRef, useState } from 'react'
import { useInput } from 'ink'
import { useOutput } from './hooks/useOutput.js'
import { useCommandHistory } from './hooks/useCommandHistory.js'
import { useSlashCommands } from './hooks/useSlashCommands.js'
import { useFileSuggestions } from './hooks/useFileSuggestions.js'
import { useExit } from './hooks/useExit.js'
import { useAgent } from './hooks/useAgent.js'
import { useLLM } from './hooks/useLLM.js'
import { useMcpCommand } from './hooks/useMcpCommand.js'
import { useSkillCommand } from './hooks/useSkillCommand.js'
import { processCommand } from './commands.js'
import type { LLMStatus } from '../types/index.js'

/**
 * 终端主逻辑 Hook
 *
 * 管理整个终端应用的核心状态和交互逻辑，包括：
 * - 输入/输出管理
 * - 斜杠命令（/help, /exit 等）处理
 * - @ 文件路径自动补全
 * - LLM Agent 通信
 * - 键盘快捷键处理
 *
 * @param onExit - 退出回调函数，当用户执行退出操作时触发
 * @returns 返回终端应用所需的所有状态和处理函数
 */
export function useTerminal(onExit?: () => void) {
  // ==================== 核心 Hooks ====================

  /** 输出管理：管理终端的输出内容（消息、命令结果、响应等） */
  const { sections, addMessage, addCommandResult, addResponse, addDiffPreview, clearSections, resetCommandList } = useOutput()

  /** 命令历史：支持上下箭头浏览历史命令 */
  const { addHistory, navigateUp } = useCommandHistory()

  /** 斜杠命令：处理 /help, /exit, /clear, /mcp 等命令的提示和选择 */
  const slash = useSlashCommands('')

  /** @ 文件路径自动补全：输入 @ 时搜索当前目录下的文件并插入路径 */
  const fileSuggestions = useFileSuggestions()

  // ==================== 状态定义 ====================

  /** 当前输入框的内容 */
  const [input, setInput] = useState('')

  /** Git 分支版本号，用于触发 InfoLine 刷新 */
  const [branchVersion, setBranchVersion] = useState(0)

  // ==================== Ref 定义 ====================
  // 使用 Ref 避免 useCallback/useEffect 中的闭包问题

  /** LLM Agent 实例 */
  const { agentRef, cancel: cancelAgent } = useAgent()

  /** 退出流程 */
  const { isExiting, triggerExit } = useExit(onExit, agentRef)

  // ==================== Ref 更新（避免闭包问题）====================

  /** 输出操作的 Ref，确保 useInput 回调能访问最新的输出函数 */
  const actionsRef = useRef({ addMessage, addCommandResult, addResponse, addDiffPreview, addHistory, clearSections, resetCommandList })
  actionsRef.current = { addMessage, addCommandResult, addResponse, addDiffPreview, addHistory, clearSections, resetCommandList }

  /** LLM 通信 */
  const { callAgent, llmStatus, tokenUsage } = useLLM(agentRef, {
    addMessage: (c, color) => actionsRef.current.addMessage(c, color as any),
    addCommandResult: (cmd, out, ok) => actionsRef.current.addCommandResult(cmd, out, ok),
    addResponse: (c) => actionsRef.current.addResponse(c),
    addDiffPreview: (fp, lang, lines) => actionsRef.current.addDiffPreview(fp, lang, lines),
    resetCommandList: () => actionsRef.current.resetCommandList(),
    onGitCommand: () => setBranchVersion(v => v + 1),
  })

  /** MCP 命令处理 */
  const { handleMcpAction } = useMcpCommand(agentRef, {
    addMessage: (c, color) => actionsRef.current.addMessage(c, color as any),
  })

  /** Skill 命令处理 */
  const { handleSkillAction } = useSkillCommand(agentRef, {
    addMessage: (c, color) => actionsRef.current.addMessage(c, color as any),
  })

  /** 输入框内容的 Ref，用于在 useInput 回调中访问最新值 */
  const inputRef = useRef('')

  /** LLM 状态的 Ref，用于在 useInput 回调中判断是否正在加载 */
  const llmStatusRef = useRef<LLMStatus>('idle')

  // 同步状态到 Ref（每次渲染时更新）
  inputRef.current = input
  llmStatusRef.current = llmStatus

  // ==================== Ref 更新（避免闭包问题）====================

  /** 斜杠命令状态的 Ref */
  const slashRef = useRef(slash)
  slashRef.current = slash

  /** 文件建议状态的 Ref */
  const fileRef = useRef(fileSuggestions)
  fileRef.current = fileSuggestions

  /** 设置输入值的 Ref，初始为空函数，后面会赋值为 setInput */
  const setInputRef = useRef<(value: string) => void>(() => {})

  /** 斜杠命令是否显示的 Ref */
  const showSlashRef = useRef(false)
  showSlashRef.current = slash.showSuggestions

  /** 文件建议是否显示的 Ref */
  const showFileRef = useRef(false)
  showFileRef.current = fileSuggestions.show

  // ==================== 事件处理函数 ====================

  /**
   * 处理输入提交
   * 流程：
   * 1. 检查是否有建议菜单显示（斜杠命令或文件建议），如果有则忽略提交
   * 2. 解析用户输入，判断是斜杠命令还是 LLM 查询
   * 3. 执行相应的操作
   */
  const handleSubmit = useCallback((line: string) => {
    // 如果有建议菜单显示，不处理提交（让用户先选择或关闭菜单）
    if (showSlashRef.current || showFileRef.current || !line.trim()) return

    // 解析并执行命令
    const action = processCommand(line, {
      addLine: actionsRef.current.addMessage,
      addHistory: actionsRef.current.addHistory,
      clearSections: actionsRef.current.clearSections,
    })

    setInput('')

    // 根据命令类型执行操作
    if (action.type === 'EXIT') {
      triggerExit()
    } else if (action.type === 'NEW_CONVERSATION') {
      agentRef.current?.clearHistory()
    } else if (action.type === 'LLM_QUERY') {
      callAgent(action.query)
    } else if (action.type === 'MCP_ACTION') {
      handleMcpAction(action.args)
    } else if (action.type === 'SKILL_ACTION') {
      handleSkillAction(action.args)
    }
  }, [callAgent, handleMcpAction, handleSkillAction])

  /** 输入框内容变化处理 */
  const handleChange = useCallback((value: string) => { setInput(value) }, [])

  // ==================== 键盘快捷键处理 ====================

  /**
   * 全局键盘事件处理
   * 优先级：
   * 1. Ctrl+C - 退出
   * 2. Escape - 取消对话 / 关闭建议菜单
   * 3. 文件建议菜单的上下键/Tab/Enter
   * 4. 斜杠命令菜单的上下键/Tab/Enter
   * 5. 空输入时的上箭头 - 浏览历史命令
   */
  useInput((char, key) => {
    // Ctrl+C: 退出程序
    if (key.ctrl && char === 'c') { triggerExit(); return }

    // Escape: 按优先级取消操作
    if (key.escape) {
      if (llmStatusRef.current === 'loading') { cancelAgent(); return }       // 取消 LLM 对话
      if (fileRef.current.show) { fileRef.current.dismiss(); return }          // 关闭文件建议
      if (slashRef.current.showSuggestions) { slashRef.current.dismiss(); return } // 关闭斜杠命令建议
    }

    // 文件建议菜单的键盘导航
    if (fileRef.current.show) {
      if (key.upArrow) { fileRef.current.selectUp(); return }                 // 上箭头：向上选择
      if (key.downArrow) { fileRef.current.selectDown(); return }             // 下箭头：向下选择
      if (key.tab || key.return) {                                            // Tab/Enter：插入文件路径
        const file = fileRef.current.getSelected()
        if (file) { setInputRef.current(fileRef.current.insertFile(inputRef.current, file)) }
        if (key.return) fileRef.current.dismiss()                             // Enter 还需要关闭菜单
        return
      }
    }

    // 斜杠命令菜单的键盘导航
    if (slashRef.current.showSuggestions) {
      if (key.upArrow) { slashRef.current.selectUp(); return }                // 上箭头
      if (key.downArrow) { slashRef.current.selectDown(); return }            // 下箭头
      if (key.tab) {                                                          // Tab：插入命令
        const cmd = slashRef.current.getSelectedCommand()
        if (cmd) setInputRef.current(cmd)
        return
      }
      if (key.return) {                                                       // Enter：插入命令并关闭菜单
        const cmd = slashRef.current.getSelectedCommand()
        if (cmd) setInputRef.current(cmd)
        slashRef.current.dismiss()
        return
      }
    }

    // 空输入时上箭头：浏览历史命令
    if (key.upArrow && inputRef.current === '') {
      const histCmd = navigateUp()
      if (histCmd !== null) setInputRef.current(histCmd)
      return
    }
  })

  // 赋值 setInput 给 Ref，供 useInput 回调使用
  setInputRef.current = setInput

  // ==================== 输入监听 ====================

  /** 监听输入变化，更新斜杠命令和文件建议的过滤结果 */
  useEffect(() => { slashRef.current.updateInput(input) }, [input])
  useEffect(() => { fileRef.current.updateInput(input) }, [input])

  // ==================== 返回值 ====================

  return {
    // 输出相关
    sections,        // 输出内容列表（消息、命令结果、响应等）

    // 输入相关
    input,           // 当前输入框内容
    handleSubmit,    // 提交处理函数
    handleChange,    // 输入变化处理函数

    // LLM 相关
    llmStatus,       // LLM 状态（idle/loading/done/error）
    tokenUsage,      // Token 使用统计（State，用于正常 UI 显示）
    cancelAgent,     // 取消对话函数

    // 退出相关
    isExiting,       // 是否正在退出

    // Git 相关
    branchVersion,   // Git 分支版本号

    // 斜杠命令相关
    showSuggestions: slash.showSuggestions,     // 是否显示斜杠命令建议
    filteredCommands: slash.filteredCommands,   // 过滤后的斜杠命令列表
    selectedIndex: slash.selectedIndex,         // 当前选中的命令索引

    // 文件建议相关
    showFileSuggestions: fileSuggestions.show,       // 是否显示文件建议
    filteredFiles: fileSuggestions.files,            // 过滤后的文件列表
    fileSelectedIndex: fileSuggestions.selectedIndex, // 当前选中的文件索引
  }
}
