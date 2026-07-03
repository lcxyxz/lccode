import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { McpClient } from './client.js'
import { adaptMcpTools } from './adapter.js'
import type { McpConfig, McpServerConfig } from './types.js'
import type { Tool } from '../tools/tool-registry.js'

const CONFIG_FILE = '.lccode/mcp.json'

export interface ToolStatus {
  name: string
  description: string
  enabled: boolean
}

export interface ServerStatus {
  name: string
  connected: boolean
  tools: ToolStatus[]
}

export interface ServerBrief {
  name: string
  connected: boolean
  toolCount: number
  activeToolCount: number
}

export class McpManager {
  private clients: McpClient[] = []
  private allTools: Map<string, Tool> = new Map()
  private activeTools: Map<string, Set<string>> = new Map()

  /** 从配置文件加载所有 MCP Server，返回适配后的工具列表 */
  async loadFromConfig(): Promise<Tool[]> {
    const configPath = join(homedir(), CONFIG_FILE)
    if (!existsSync(configPath)) return []

    const config: McpConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
    return this.loadConfig(config)
  }

  /** 加载配置对象，返回适配后的工具列表 */
  async loadConfig(config: McpConfig): Promise<Tool[]> {
    const servers = config.mcpServers || {}
    const results = await Promise.allSettled(
      Object.entries(servers).map(([name, cfg]) => this.connectServer(name, cfg))
    )

    const tools: Tool[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') tools.push(...r.value)
    }
    return tools
  }

  private async connectServer(name: string, config: McpServerConfig): Promise<Tool[]> {
    const client = new McpClient(name)
    await client.connect(config)
    this.clients.push(client)
    const tools = adaptMcpTools(client, client.availableTools)

    for (const tool of tools) {
      this.allTools.set(tool.name, tool)
    }
    // MCP 工具默认禁用，需通过 /mcp 命令手动启用
    this.activeTools.set(name, new Set())

    return tools
  }

  /** 获取所有已加载的工具 */
  getAllTools(): Tool[] {
    return Array.from(this.allTools.values())
  }

  /** 获取所有启用的工具名称 */
  getActiveToolNames(): Set<string> {
    const result = new Set<string>()
    for (const tools of this.activeTools.values()) {
      for (const name of tools) result.add(name)
    }
    return result
  }

  /** 获取所有服务器状态（含工具启用情况） */
  getServerStatus(): ServerStatus[] {
    return this.clients.map(client => ({
      name: client.name,
      connected: client.isConnected,
      tools: client.availableTools.map(t => {
        const toolName = `mcp__${client.name}__${t.name}`
        return {
          name: toolName,
          description: t.description || '',
          enabled: this.activeTools.get(client.name)?.has(toolName) ?? true,
        }
      }),
    }))
  }

  /** 获取服务器简要信息（用于紧凑列表显示） */
  getServerBriefList(): ServerBrief[] {
    return this.clients.map(client => {
      const allToolNames = client.availableTools.map(t => `mcp__${client.name}__${t.name}`)
      const activeSet = this.activeTools.get(client.name)
      const activeCount = activeSet ? allToolNames.filter(n => activeSet.has(n)).length : 0
      return {
        name: client.name,
        connected: client.isConnected,
        toolCount: allToolNames.length,
        activeToolCount: activeCount,
      }
    })
  }

  /** 按编号切换整个服务器的所有工具 */
  toggleServerByIndex(index: number): { server: string; enabled: boolean; toolCount: number } | null {
    const servers = this.getServerBriefList()
    if (index < 0 || index >= servers.length) return null
    const server = servers[index]
    const client = this.clients.find(c => c.name === server.name)
    if (!client) return null

    const allToolNames = client.availableTools.map(t => `mcp__${client.name}__${t.name}`)
    const currentActive = this.activeTools.get(server.name)
    const allEnabled = currentActive && allToolNames.every(n => currentActive.has(n))

    if (allEnabled) {
      this.activeTools.set(server.name, new Set())
      return { server: server.name, enabled: false, toolCount: allToolNames.length }
    } else {
      this.activeTools.set(server.name, new Set(allToolNames))
      return { server: server.name, enabled: true, toolCount: allToolNames.length }
    }
  }

  /** 启用所有工具 */
  enableAll(): void {
    for (const [serverName, client] of this.clients.map(c => [c.name, c] as const)) {
      const tools = client.availableTools.map(t => `mcp__${serverName}__${t.name}`)
      this.activeTools.set(serverName, new Set(tools))
    }
  }

  /** 禁用所有工具 */
  disableAll(): void {
    for (const [serverName] of this.activeTools) {
      this.activeTools.set(serverName, new Set())
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled(this.clients.map(c => c.disconnect()))
    this.clients = []
    this.allTools.clear()
    this.activeTools.clear()
  }
}