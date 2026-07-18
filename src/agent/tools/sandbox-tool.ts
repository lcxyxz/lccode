/**
 * 沙箱权限管理工具
 * 允许用户配置 agent 的权限
 */
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  type PermissionType,
  hasPermission,
  enablePermission,
  disablePermission,
  resetSandboxConfig,
  setPreset,
  loadSandboxConfig,
  saveSandboxConfig,
  getSandboxConfigSummary,
} from '../../utils/sandbox.js'
import type { Tool, ToolResult } from './tool-registry.js'

/**
 * 沙箱权限管理工具
 */
export const sandboxTool: Tool = {
  name: 'sandbox',
  description: `管理 agent 的沙箱权限。可以查看、启用、禁用权限，或使用预设配置。
- list: 查看当前权限状态
- enable: 启用指定权限
- disable: 禁用指定权限
- preset: 使用预设配置 (strict/relaxed/permissive)
- reset: 重置为默认配置
- add_allowed: 添加自定义允许的命令前缀
- remove_allowed: 移除自定义允许的命令前缀
- add_denied: 添加自定义拒绝的命令模式
- remove_denied: 移除自定义拒绝的命令模式`,
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: '操作类型: list, enable, disable, preset, reset, add_allowed, remove_allowed, add_denied, remove_denied',
      required: true,
    },
    {
      name: 'permission',
      type: 'string',
      description: '权限名称 (enable/disable 时必填): network, env_vars, process, system_dirs, user_dirs, parent_traversal, absolute_paths',
      required: false,
    },
    {
      name: 'preset',
      type: 'string',
      description: '预设配置名称 (preset 时必填): strict, relaxed, permissive',
      required: false,
    },
    {
      name: 'pattern',
      type: 'string',
      description: '命令模式 (add_allowed/add_denied 时必填)',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const action = params.action
      const permission = params.permission as PermissionType | undefined
      const preset = params.preset
      const pattern = params.pattern

      switch (action) {
        case 'list': {
          const summary = getSandboxConfigSummary()
          const permissionList = ALL_PERMISSIONS.map(p => {
            const status = hasPermission(p) ? '✓ 启用' : '✗ 禁用'
            return `  - ${p}: ${status} - ${PERMISSION_DESCRIPTIONS[p]}`
          }).join('\n')

          return {
            success: true,
            output: `${summary}\n\n详细权限列表:\n${permissionList}\n\n使用示例:\n  - 启用网络权限: sandbox(enable, permission="network")\n  - 使用宽松预设: sandbox(preset, preset="relaxed")`,
          }
        }

        case 'enable': {
          if (!permission) {
            return { success: false, output: '', error: '请指定要启用的权限' }
          }
          if (!ALL_PERMISSIONS.includes(permission)) {
            return { success: false, output: '', error: `无效的权限: ${permission}。可用权限: ${ALL_PERMISSIONS.join(', ')}` }
          }

          enablePermission(permission)
          return {
            success: true,
            output: `已启用权限: ${permission}\n${PERMISSION_DESCRIPTIONS[permission]}`,
          }
        }

        case 'disable': {
          if (!permission) {
            return { success: false, output: '', error: '请指定要禁用的权限' }
          }
          if (!ALL_PERMISSIONS.includes(permission)) {
            return { success: false, output: '', error: `无效的权限: ${permission}。可用权限: ${ALL_PERMISSIONS.join(', ')}` }
          }

          disablePermission(permission)
          return {
            success: true,
            output: `已禁用权限: ${permission}\n${PERMISSION_DESCRIPTIONS[permission]}`,
          }
        }

        case 'preset': {
          if (!preset || !['strict', 'relaxed', 'permissive'].includes(preset)) {
            return { success: false, output: '', error: '请指定预设配置: strict, relaxed, permissive' }
          }

          setPreset(preset as 'strict' | 'relaxed' | 'permissive')

          const descriptions: Record<string, string> = {
            strict: '严格模式 - 禁用所有敏感权限',
            relaxed: '宽松模式 - 允许网络访问和环境变量',
            permissive: '开放模式 - 允许除绝对路径外的所有权限',
          }

          return {
            success: true,
            output: `已应用预设配置: ${preset}\n${descriptions[preset]}\n\n${getSandboxConfigSummary()}`,
          }
        }

        case 'reset': {
          resetSandboxConfig()
          return {
            success: true,
            output: `已重置为默认配置（严格模式）\n\n${getSandboxConfigSummary()}`,
          }
        }

        case 'add_allowed': {
          if (!pattern) {
            return { success: false, output: '', error: '请指定要添加的命令前缀' }
          }

          const config = loadSandboxConfig()
          if (!config.allowedCommandPrefixes.includes(pattern)) {
            config.allowedCommandPrefixes.push(pattern)
            saveSandboxConfig(config)
          }

          return {
            success: true,
            output: `已添加自定义允许命令前缀: ${pattern}\n当前允许前缀: ${config.allowedCommandPrefixes.join(', ')}`,
          }
        }

        case 'remove_allowed': {
          if (!pattern) {
            return { success: false, output: '', error: '请指定要移除的命令前缀' }
          }

          const config2 = loadSandboxConfig()
          config2.allowedCommandPrefixes = config2.allowedCommandPrefixes.filter(p => p !== pattern)
          saveSandboxConfig(config2)

          return {
            success: true,
            output: `已移除自定义允许命令前缀: ${pattern}\n当前允许前缀: ${config2.allowedCommandPrefixes.join(', ') || '无'}`,
          }
        }

        case 'add_denied': {
          if (!pattern) {
            return { success: false, output: '', error: '请指定要添加的拒绝模式（正则表达式）' }
          }

          const config3 = loadSandboxConfig()
          if (!config3.deniedCommandPatterns.includes(pattern)) {
            config3.deniedCommandPatterns.push(pattern)
            saveSandboxConfig(config3)
          }

          return {
            success: true,
            output: `已添加自定义拒绝模式: ${pattern}\n当前拒绝模式: ${config3.deniedCommandPatterns.join(', ')}`,
          }
        }

        case 'remove_denied': {
          if (!pattern) {
            return { success: false, output: '', error: '请指定要移除的拒绝模式' }
          }

          const config4 = loadSandboxConfig()
          config4.deniedCommandPatterns = config4.deniedCommandPatterns.filter(p => p !== pattern)
          saveSandboxConfig(config4)

          return {
            success: true,
            output: `已移除自定义拒绝模式: ${pattern}\n当前拒绝模式: ${config4.deniedCommandPatterns.join(', ') || '无'}`,
          }
        }

        default:
          return { success: false, output: '', error: `不支持的操作: ${action}` }
      }
    } catch (error: any) {
      return { success: false, output: '', error: `操作失败: ${error.message}` }
    }
  },
}
