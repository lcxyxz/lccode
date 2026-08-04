/**
 * Plan Agent - 将复杂任务规划为可执行步骤
 */

import { createProvider, type LLMProvider } from '../../services/index.js'
import type { ChatMessage } from '../../services/types.js'
import type { AgentConfig } from '../../types/index.js'

export interface PlanStep {
  id: string
  description: string
  action: string
  dependencies: string[]
}

export interface PlanResult {
  success: boolean
  steps: PlanStep[]
  summary: string
}

export class PlanAgent {
  private provider: LLMProvider

  constructor(config: AgentConfig) {
    this.provider = createProvider(config)
  }

  async plan(taskDescription: string): Promise<PlanResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a task planning expert. Break down complex tasks into executable steps.
Output JSON format:
{
  "success": true,
  "steps": [{"id": "step-1", "description": "...", "action": "...", "dependencies": []}],
  "summary": "plan summary"
}`
      },
      { role: 'user', content: taskDescription }
    ]

    try {
      const result = await this.provider.chat(messages)
      const json = result.response.match(/\{[\s\S]*\}/)?.[0]
      if (!json) return { success: false, steps: [], summary: 'Parse failed' }
      return JSON.parse(json)
    } catch (error) {
      return { success: false, steps: [], summary: String(error) }
    }
  }
}

export function createPlanAgentTool(config: AgentConfig) {
  return {
    name: 'plan_task',
    description: 'Break a complex task into executable steps',
    parameters: [
      { name: 'task', type: 'string' as const, description: 'Task description', required: true }
    ],
    execute: async (params: Record<string, any>) => {
      const agent = new PlanAgent(config)
      const result = await agent.plan(params.task)
      return { success: result.success, output: JSON.stringify(result, null, 2) }
    }
  }
}
