import { useEffect, useCallback, useRef, useState } from 'react'
import { useInput } from 'ink'
import { useOutput } from './hooks/useOutput.js'
import { useCommandHistory } from './hooks/useCommandHistory.js'
import { useSlashCommands } from './hooks/useSlashCommands.js'
import { useFileSuggestions } from './hooks/useFileSuggestions.js'
import { processCommand } from './commands.js'
import { Agent } from '../agent/agent.js'
import type { LLMStatus, TokenUsage } from '../types/index.js'
import { LogLevel } from '../utils/logger.js'

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

  /** LLM 状态：idle(空闲) | loading(加载中) | done(完成) | error(错误) */
  const [llmStatus, setLlmStatus] = useState<LLMStatus>('idle')

  /** 当前输入框的内容 */
  const [input, setInput] = useState('')

  /** Token 使用统计（提示词 + 完成词 = 总计） */
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })

  /** 是否正在退出（控制退出画面显示） */
  const [isExiting, setIsExiting] = useState(false)

  // ==================== Ref 定义 ====================
  // 使用 Ref 避免 useCallback/useEffect 中的闭包问题

  /** LLM Agent 实例，负责与大模型通信和工具调用 */
  const agentRef = useRef<Agent | null>(null)

  /** 输入框内容的 Ref，用于在 useInput 回调中访问最新值 */
  const inputRef = useRef('')

  /** LLM 状态的 Ref，用于在 useInput 回调中判断是否正在加载 */
  const llmStatusRef = useRef<LLMStatus>('idle')

  // 同步状态到 Ref（每次渲染时更新）
  inputRef.current = input
  llmStatusRef.current = llmStatus

  // ==================== Agent 初始化 ====================

  /**
   * 初始化 LLM Agent
   * 从环境变量读取 API 配置，创建 Agent 实例
   */
  useEffect(() => {
    const apiKey = process.env.LCCODE_API_KEY
    if (apiKey) {
      Agent.create(
        {
          apiKey,
          baseUrl: process.env.LCCODE_BASE_URL,
          model: process.env.LCCODE_MODEL,
          provider: process.env.LCCODE_PROVIDER as any,
        },
        { level: LogLevel.DEBUG }
      ).then(agent => { agentRef.current = agent })
    }
  }, [])

  // ==================== Ref 更新（避免闭包问题）====================

  /** 输出操作的 Ref，确保 useInput 回调能访问最新的输出函数 */
  const actionsRef = useRef({ addMessage, addCommandResult, addResponse, addDiffPreview, addHistory, clearSections, resetCommandList })
  actionsRef.current = { addMessage, addCommandResult, addResponse, addDiffPreview, addHistory, clearSections, resetCommandList }

  /** 斜杠命令状态的 Ref */
  const slashRef = useRef(slash)
  slashRef.current = slash

  /** 文件建议状态的 Ref */
  const fileRef = useRef(fileSuggestions)
  fileRef.current = fileSuggestions

  /** 退出回调的 Ref */
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  /** 设置输入值的 Ref，初始为空函数，后面会赋值为 setInput */
  const setInputRef = useRef<(value: string) => void>(() => {})

  /** 斜杠命令是否显示的 Ref */
  const showSlashRef = useRef(false)
  showSlashRef.current = slash.showSuggestions

  /** 文件建议是否显示的 Ref */
  const showFileRef = useRef(false)
  showFileRef.current = fileSuggestions.show

  // ==================== 事件处理函数 ====================

  /** 触发退出流程：设 isExiting → 断开 Agent → 延迟退出 */
  const triggerExit = useCallback(() => {
    setIsExiting(true)
    // 异步断开 MCP 连接（不阻塞渲染）
    agentRef.current?.disconnect?.()
  }, [])

  /** 处理 Ctrl+C：触发退出 */
  const handleCtrlC = useCallback(() => {
    triggerExit()
  }, [triggerExit])

  /** 取消当前正在进行的 LLM 对话 */
  const cancelAgent = useCallback(() => {
    agentRef.current?.cancel()
  }, [])

  /**
   * 处理 /mcp 命令
   * 支持的子命令：
   * - /mcp 或 /mcp list/status：显示所有 MCP 服务器状态
   * - /mcp all：启用所有服务器
   * - /mcp none：禁用所有服务器
   * - /mcp 1,2：按编号切换服务器的启用/禁用状态
   */
  const handleMcpAction = useCallback((args: string[]) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: Agent not initialized.', 'yellow')
      return
    }

    const mcpManager = agent.getMcpManager()
    const subcmd = args[0]?.toLowerCase()

    // 显示 MCP 服务器列表
    if (!subcmd || subcmd === 'list' || subcmd === 'status') {
      const servers = mcpManager.getServerBriefList()
      if (servers.length === 0) {
        actionsRef.current.addMessage('No MCP servers configured.', 'yellow')
        return
      }

      let output = 'MCP Servers:\n────────────\n'
      servers.forEach((s, i) => {
        const status = s.activeToolCount === s.toolCount ? '✅' : s.activeToolCount > 0 ? '🟡' : '❌'
        const conn = s.connected ? '●' : '○'
        output += `  ${i + 1}. ${status} [${conn}] ${s.name} (${s.activeToolCount}/${s.toolCount} tools)\n`
      })
      output += '\nUsage:\n  /mcp           - Show this list\n  /mcp 1,2       - Toggle servers by number\n  /mcp all       - Enable all servers\n  /mcp none      - Disable all servers'
      actionsRef.current.addMessage(output, 'cyan')
      return
    }

    // 启用所有服务器
    if (subcmd === 'all') {
      mcpManager.enableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers enabled.', 'green')
      return
    }

    // 禁用所有服务器
    if (subcmd === 'none') {
      mcpManager.disableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers disabled.', 'yellow')
      return
    }

    // 按编号切换服务器状态
    const numbers = args.join(',').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    if (numbers.length === 0) {
      actionsRef.current.addMessage('Invalid usage. See /mcp for help.', 'yellow')
      return
    }

    const results: string[] = []
    for (const num of numbers) {
      const result = mcpManager.toggleServerByIndex(num - 1)
      if (result) {
        results.push(`${result.server} → ${result.enabled ? 'enabled' : 'disabled'} (${result.toolCount} tools)`)
      } else {
        results.push(`#${num}: invalid server number`)
      }
    }
    agent.refreshToolFilter()
    actionsRef.current.addMessage(results.join('\n'), 'cyan')
  }, [])

  /**
   * 调用 LLM Agent 处理用户输入
   * 支持多轮对话，处理各种事件类型：
   * - thinking: 思考过程（不显示）
   * - command: 工具调用结果
   * - response: AI 响应
   * - error: 错误信息
   * - token_usage: Token 使用统计
   * - diff_preview: 代码差异预览
   */
  const callAgent = useCallback(async (query: string) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: LCCODE_API_KEY not set.', 'yellow')
      return
    }

    actionsRef.current.resetCommandList()
    setLlmStatus('loading')
    let cancelled = false

    try {
      for await (const event of agent.processInput(query)) {
        switch (event.type) {
          case 'thinking':
            // 思考过程，暂时不显示
            break
          case 'command':
            // 工具调用结果
            if (event.metadata) {
              actionsRef.current.addCommandResult(
                event.metadata.command ?? '',
                event.metadata.commandOutput ?? '',
                event.metadata.success ?? false,
              )
            }
            break
          case 'response':
            // AI 最终响应
            actionsRef.current.addResponse(event.content ?? '')
            break
          case 'error':
            // 错误处理，如果是取消操作则标记
            if (event.content === '对话已取消') { cancelled = true }
            actionsRef.current.addMessage(event.content ?? 'Unknown error', 'yellow')
            break
          case 'token_usage':
            // 累计 Token 使用量
            if (event.usage) {
              setTokenUsage(prev => ({
                promptTokens: prev.promptTokens + event.usage!.promptTokens,
                completionTokens: prev.completionTokens + event.usage!.completionTokens,
                totalTokens: prev.totalTokens + event.usage!.totalTokens,
              }))
            }
            break
          case 'diff_preview':
            // 代码编辑后的差异预览
            if (event.diffPreview) {
              actionsRef.current.addDiffPreview(
                event.diffPreview.filePath,
                event.diffPreview.language,
                event.diffPreview.lines,
              )
            }
            break
        }
      }
      setLlmStatus(cancelled ? 'idle' : 'done')
    } catch (error: any) {
      actionsRef.current.addMessage(`LLM Error: ${error?.message || 'Unknown error'}`, 'yellow')
      setLlmStatus('error')
    }
  }, [])

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
    } else if (action.type === 'LLM_QUERY') {
      callAgent(action.query)
    } else if (action.type === 'MCP_ACTION') {
      handleMcpAction(action.args)
    }
  }, [callAgent, handleMcpAction])

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
    if (key.ctrl && char === 'c') { handleCtrlC(); return }

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

  // ==================== 退出逻辑 ====================

  /** isExiting 变为 true 后，等待 Ink 渲染退出画面，然后调用 onExit 回调 */
  useEffect(() => {
    if (isExiting) {
      // 给 Ink 一帧时间渲染退出画面，然后触发退出回调
      const timer = setTimeout(() => {
        onExitRef.current?.()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isExiting])

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
    tokenUsage,      // Token 使用统计
    cancelAgent,     // 取消对话函数

    // 退出相关
    isExiting,       // 是否正在退出

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
