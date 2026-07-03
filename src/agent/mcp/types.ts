export interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    mimeType?: string
    data?: string
  }>
  isError?: boolean
}
