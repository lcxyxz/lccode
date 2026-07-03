import type { McpClient } from './client.js'
import type { McpToolDefinition, McpToolResult } from './types.js'
import type { Tool, ToolResult } from '../tools/tool-registry.js'

export function adaptMcpTools(client: McpClient, mcpTools: McpToolDefinition[]): Tool[] {
  return mcpTools.map(mcpTool => ({
    name: `mcp__${client.name}__${mcpTool.name}`,
    description: mcpTool.description || `MCP tool from ${client.name}`,
    parameters: convertInputSchema(mcpTool),
    execute: async (params): Promise<ToolResult> => {
      try {
        const result = await client.callTool(mcpTool.name, params)
        return formatMcpResult(result)
      } catch (error: any) {
        return { success: false, output: '', error: `MCP tool failed: ${error.message}` }
      }
    },
  }))
}

function convertInputSchema(mcpTool: McpToolDefinition): Tool['parameters'] {
  const { required = [], properties = {} } = mcpTool.inputSchema
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: prop.type === 'number' || prop.type === 'integer' ? 'number' as const
      : prop.type === 'boolean' ? 'boolean' as const
      : 'string' as const,
    description: prop.description || '',
    required: required.includes(name),
  }))
}

function formatMcpResult(result: McpToolResult): ToolResult {
  if (result.isError) {
    const errorText = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    return { success: false, output: '', error: errorText || 'Unknown MCP error' }
  }
  const text = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
  return { success: true, output: text || '(no output)' }
}
