import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { McpClient } from './client.js'
import { adaptMcpTools } from './adapter.js'
import type { McpConfig, McpServerConfig } from './types.js'
import type { Tool } from '../tools/tool-registry.js'

const CONFIG_FILE = '.lccode/mcp.json'

export class McpManager {
  private clients: McpClient[] = []

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
    return adaptMcpTools(client, client.availableTools)
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled(this.clients.map(c => c.disconnect()))
    this.clients = []
  }
}