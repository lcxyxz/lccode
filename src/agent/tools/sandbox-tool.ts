/**
 * Sandbox permission management tool
 * Allows users to configure agent permissions
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
 * Sandbox permission management tool
 */
export const sandboxTool: Tool = {
  name: 'sandbox',
  description: `Manage agent sandbox permissions. View, enable, disable permissions, or use presets.
- list: view current permission status
- enable: enable a permission
- disable: disable a permission
- preset: apply a preset (strict/relaxed/permissive)
- reset: reset to default config
- add_allowed: add custom allowed command prefix
- remove_allowed: remove custom allowed command prefix
- add_denied: add custom denied command pattern
- remove_denied: remove custom denied command pattern`,
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'Action: list, enable, disable, preset, reset, add_allowed, remove_allowed, add_denied, remove_denied',
      required: true,
    },
    {
      name: 'permission',
      type: 'string',
      description: 'Permission name (required for enable/disable): network, env_vars, process, system_dirs, user_dirs, parent_traversal, absolute_paths',
      required: false,
    },
    {
      name: 'preset',
      type: 'string',
      description: 'Preset name (required for preset): strict, relaxed, permissive',
      required: false,
    },
    {
      name: 'pattern',
      type: 'string',
      description: 'Command pattern (required for add_allowed/add_denied)',
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
            const status = hasPermission(p) ? '✓ enabled' : '✗ disabled'
            return `  - ${p}: ${status} - ${PERMISSION_DESCRIPTIONS[p]}`
          }).join('\n')

          return {
            success: true,
            output: `${summary}\n\nPermission list:\n${permissionList}\n\nExamples:\n  - Enable network: sandbox(enable, permission="network")\n  - Apply relaxed preset: sandbox(preset, preset="relaxed")`,
          }
        }

        case 'enable': {
          if (!permission) {
            return { success: false, output: '', error: 'Specify permission to enable' }
          }
          if (!ALL_PERMISSIONS.includes(permission)) {
            return { success: false, output: '', error: `Invalid permission: ${permission}. Available: ${ALL_PERMISSIONS.join(', ')}` }
          }

          enablePermission(permission)
          return {
            success: true,
            output: `Enabled permission: ${permission}\n${PERMISSION_DESCRIPTIONS[permission]}`,
          }
        }

        case 'disable': {
          if (!permission) {
            return { success: false, output: '', error: 'Specify permission to disable' }
          }
          if (!ALL_PERMISSIONS.includes(permission)) {
            return { success: false, output: '', error: `Invalid permission: ${permission}. Available: ${ALL_PERMISSIONS.join(', ')}` }
          }

          disablePermission(permission)
          return {
            success: true,
            output: `Disabled permission: ${permission}\n${PERMISSION_DESCRIPTIONS[permission]}`,
          }
        }

        case 'preset': {
          if (!preset || !['strict', 'relaxed', 'permissive'].includes(preset)) {
            return { success: false, output: '', error: 'Specify preset: strict, relaxed, permissive' }
          }

          setPreset(preset as 'strict' | 'relaxed' | 'permissive')

          const descriptions: Record<string, string> = {
            strict: 'Strict - disable all sensitive permissions',
            relaxed: 'Relaxed - allow network access and env vars',
            permissive: 'Permissive - allow all except absolute paths',
          }

          return {
            success: true,
            output: `Applied preset: ${preset}\n${descriptions[preset]}\n\n${getSandboxConfigSummary()}`,
          }
        }

        case 'reset': {
          resetSandboxConfig()
          return {
            success: true,
            output: `Reset to default config (strict)\n\n${getSandboxConfigSummary()}`,
          }
        }

        case 'add_allowed': {
          if (!pattern) {
            return { success: false, output: '', error: 'Specify command prefix to add' }
          }

          const config = loadSandboxConfig()
          if (!config.allowedCommandPrefixes.includes(pattern)) {
            config.allowedCommandPrefixes.push(pattern)
            saveSandboxConfig(config)
          }

          return {
            success: true,
            output: `Added custom allowed prefix: ${pattern}\nCurrent allowed prefixes: ${config.allowedCommandPrefixes.join(', ')}`,
          }
        }

        case 'remove_allowed': {
          if (!pattern) {
            return { success: false, output: '', error: 'Specify command prefix to remove' }
          }

          const config2 = loadSandboxConfig()
          config2.allowedCommandPrefixes = config2.allowedCommandPrefixes.filter(p => p !== pattern)
          saveSandboxConfig(config2)

          return {
            success: true,
            output: `Removed custom allowed prefix: ${pattern}\nCurrent allowed prefixes: ${config2.allowedCommandPrefixes.join(', ') || 'none'}`,
          }
        }

        case 'add_denied': {
          if (!pattern) {
            return { success: false, output: '', error: 'Specify denied pattern to add (regex)' }
          }

          const config3 = loadSandboxConfig()
          if (!config3.deniedCommandPatterns.includes(pattern)) {
            config3.deniedCommandPatterns.push(pattern)
            saveSandboxConfig(config3)
          }

          return {
            success: true,
            output: `Added custom denied pattern: ${pattern}\nCurrent denied patterns: ${config3.deniedCommandPatterns.join(', ')}`,
          }
        }

        case 'remove_denied': {
          if (!pattern) {
            return { success: false, output: '', error: 'Specify denied pattern to remove' }
          }

          const config4 = loadSandboxConfig()
          config4.deniedCommandPatterns = config4.deniedCommandPatterns.filter(p => p !== pattern)
          saveSandboxConfig(config4)

          return {
            success: true,
            output: `Removed custom denied pattern: ${pattern}\nCurrent denied patterns: ${config4.deniedCommandPatterns.join(', ') || 'none'}`,
          }
        }

        default:
          return { success: false, output: '', error: `Unsupported action: ${action}` }
      }
    } catch (error: any) {
      return { success: false, output: '', error: `Operation failed: ${error.message}` }
    }
  },
}
