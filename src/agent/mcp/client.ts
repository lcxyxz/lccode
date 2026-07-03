import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpServerConfig, McpToolDefinition, McpToolResult } from './types.js'

export class McpClient {
  private client: Client
  private transport: StdioClientTransport | null = null
  private serverName: string
  private connected = false
  private tools: McpToolDefinition[] = []

  constructor(serverName: string) {
    this.serverName = serverName
    this.client = new Client({ name: `lccode-${serverName}`, version: '1.0.0' })
  }

  get name(): string {
    return this.serverName
  }

  get isConnected(): boolean {
    return this.connected
  }

  get availableTools(): McpToolDefinition[] {
    return this.tools
  }

  async connect(config: McpServerConfig): Promise<void> {
    if (this.connected) return

    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env as Record<string, string>,
      stderr: 'ignore',
    })

    await this.client.connect(this.transport)
    this.connected = true

    const response = await this.client.listTools()
    this.tools = response.tools
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<McpToolResult> {
    if (!this.connected) {
      throw new Error(`MCP server "${this.serverName}" is not connected`)
    }

    const result = await this.client.callTool({ name: toolName, arguments: args })
    return result as unknown as McpToolResult
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.close()
    this.connected = false
    this.tools = []
  }
}
