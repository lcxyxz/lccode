import { createPlanAgentTool } from '../subagents/planagent.js'
import type { AgentConfig } from '../../types/index.js'
import type { Tool } from './tool-registry.js'

export function planTool(config: AgentConfig): Tool {
  return createPlanAgentTool(config)
}
