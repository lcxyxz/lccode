/**
 * 工作区沙箱模块
 * 限制 agent 只能在工作区内操作，防止访问敏感文件
 * 支持用户自定义权限配置
 */
import { resolve, relative, isAbsolute } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** 工作区根目录 */
const WORKSPACE_ROOT = process.cwd()

/** 沙箱配置目录 */
const SANDBOX_CONFIG_DIR = join(WORKSPACE_ROOT, '.lccode')
const SANDBOX_CONFIG_FILE = join(SANDBOX_CONFIG_DIR, 'sandbox.json')

/** 权限类型定义 */
export type PermissionType =
  | 'network'           // 网络访问 (curl, wget, ssh 等)
  | 'env_vars'          // 环境变量访问 ($HOME, $USER 等)
  | 'process'           // 进程操作 (kill, pkill 等)
  | 'system_dirs'       // 系统目录访问 (/etc, /usr 等)
  | 'user_dirs'         // 用户目录访问 (/home, ~ 等)
  | 'parent_traversal'  // 父目录穿越 (..)
  | 'absolute_paths'    // 绝对路径访问 (/ 开头的路径)

/** 所有可用权限 */
export const ALL_PERMISSIONS: PermissionType[] = [
  'network',
  'env_vars',
  'process',
  'system_dirs',
  'user_dirs',
  'parent_traversal',
  'absolute_paths',
]

/** 权限描述 */
export const PERMISSION_DESCRIPTIONS: Record<PermissionType, string> = {
  network: '允许网络访问 (curl, wget, ssh, scp 等)',
  env_vars: '允许访问环境变量 ($HOME, $USER, $PATH 等)',
  process: '允许进程操作 (kill, pkill, killall 等)',
  system_dirs: '允许访问系统目录 (/etc, /usr, /var 等)',
  user_dirs: '允许访问用户目录 (/home, ~ 等)',
  parent_traversal: '允许使用 .. 穿越目录',
  absolute_paths: '允许访问绝对路径 (/ 开头的路径)',
}

/** 沙箱配置接口 */
export interface SandboxConfig {
  /** 已启用的权限列表 */
  enabled: PermissionType[]
  /** 已禁用的权限列表 */
  disabled: PermissionType[]
  /** 自定义允许的命令前缀 */
  allowedCommandPrefixes: string[]
  /** 自定义允许的路径前缀 */
  allowedPathPrefixes: string[]
  /** 自定义拒绝的命令模式 */
  deniedCommandPatterns: string[]
}

/** 默认配置：开发友好模式 */
const DEFAULT_CONFIG: SandboxConfig = {
  enabled: [
    'network',          // npm/pip/docker 都需要网络
    'env_vars',         // 脚本和工具链依赖环境变量
    'parent_traversal', // ../ 是开发中的基本操作
    'user_dirs',        // ~/ 是常见路径
    'absolute_paths',   // /tmp, /opt 等需要访问
  ],
  disabled: [
    'system_dirs',      // 修改系统配置
    'process',          // 进程
  ],
  allowedCommandPrefixes: [
    'docker',           // 容器化开发
    'python', 'python3', // 脚本和工具
    'node', 'npm', 'npx', 'yarn', 'pnpm', // JS 生态
    'cargo', 'rustup',  // Rust
    'go',               // Go
    'java', 'javac',    // Java
    'make', 'cmake',    // 构建工具
    'vim', 'nano',      // 编辑器
    'pip', 'pip3',      // Python 包
    'gem', 'bundle',    // Ruby
    'gradle', 'mvn',    // JVM 构建
    'gh', 'glab',       // Git 平台 CLI
  ],
  allowedPathPrefixes: [],
  deniedCommandPatterns: [
    'rm\\s+-rf\\s+/',         // 拦截 rm -rf /
    'sudo\\s+rm',             // 拦截 sudo rm
    'mkfs',                   // 拦截格式化
    'dd\\s+if=',              // 拦截 dd
    ':\\(\\)\\{.*\\|.*&\\s*\\}:', // 拦截 fork bomb
    '\\|\\s*(bash|sh|cmd|powershell)\\b', // 拦截管道到 shell
  ],
}

/** 缓存的配置 */
let cachedConfig: SandboxConfig | null = null

/**
 * 加载沙箱配置
 */
export function loadSandboxConfig(): SandboxConfig {
  if (cachedConfig) return cachedConfig

  if (!existsSync(SANDBOX_CONFIG_FILE)) {
    cachedConfig = DEFAULT_CONFIG
    return cachedConfig
  }

  try {
    const content = readFileSync(SANDBOX_CONFIG_FILE, 'utf-8')
    const config = JSON.parse(content) as Partial<SandboxConfig>
    cachedConfig = { ...DEFAULT_CONFIG, ...config }
    return cachedConfig
  } catch {
    cachedConfig = DEFAULT_CONFIG
    return cachedConfig
  }
}

/**
 * 保存沙箱配置
 */
export function saveSandboxConfig(config: SandboxConfig): void {
  if (!existsSync(SANDBOX_CONFIG_DIR)) {
    mkdirSync(SANDBOX_CONFIG_DIR, { recursive: true })
  }
  writeFileSync(SANDBOX_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  cachedConfig = config
}

/**
 * 检查某个权限是否已启用
 */
export function hasPermission(permission: PermissionType): boolean {
  const config = loadSandboxConfig()
  return config.enabled.includes(permission)
}

/**
 * 启用权限
 */
export function enablePermission(permission: PermissionType): void {
  const config = loadSandboxConfig()
  if (!config.enabled.includes(permission)) {
    config.enabled.push(permission)
  }
  config.disabled = config.disabled.filter(p => p !== permission)
  saveSandboxConfig(config)
}

/**
 * 禁用权限
 */
export function disablePermission(permission: PermissionType): void {
  const config = loadSandboxConfig()
  if (!config.disabled.includes(permission)) {
    config.disabled.push(permission)
  }
  config.enabled = config.enabled.filter(p => p !== permission)
  saveSandboxConfig(config)
}

/**
 * 重置为默认配置（严格模式）
 */
export function resetSandboxConfig(): void {
  saveSandboxConfig(DEFAULT_CONFIG)
}

/**
 * 设置预设配置
 */
export function setPreset(preset: 'strict' | 'relaxed' | 'permissive'): void {
  const config: SandboxConfig = {
    ...DEFAULT_CONFIG,
  }

  switch (preset) {
    case 'strict':
      // 严格模式：全部禁用
      config.enabled = []
      config.disabled = [...ALL_PERMISSIONS]
      config.allowedCommandPrefixes = []
      config.deniedCommandPatterns = [
        'rm\\s+-rf\\s+/',
        'sudo\\s+rm',
        'mkfs',
        'dd\\s+if=',
        ':\\(\\)\\{.*\\|.*&\\s*\\}:',
        '\\|\\s*(bash|sh|cmd|powershell)\\b',
      ]
      break
    case 'relaxed':
      // 宽松模式：当前默认配置（开发友好）
      break
    case 'permissive':
      // 开放模式：允许所有权限
      config.enabled = [...ALL_PERMISSIONS]
      config.disabled = []
      break
  }

  saveSandboxConfig(config)
}

/**
 * 验证路径是否在工作区内
 * 防止 ../path 穿越攻击
 */
export function validatePath(filePath: string): { valid: boolean; resolved?: string; error?: string } {
  // 解析绝对路径
  const resolved = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(WORKSPACE_ROOT, filePath)

  // 检查是否在工作区内
  const rel = relative(WORKSPACE_ROOT, resolved)

  // relative 返回 '..' 开头表示在工作区外
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return {
      valid: false,
      error: `路径越界: ${filePath} 不在工作区内`,
    }
  }

  return { valid: true, resolved }
}

/**
 * 从命令中提取所有路径参数
 */
function extractPaths(command: string): string[] {
  const paths: string[] = []
  const parts = command.split(/\s+/)

  for (const part of parts) {
    // 跳过命令本身和选项
    if (part.startsWith('-') || !part) continue

    // 检测绝对路径
    if (part.startsWith('/')) {
      paths.push(part)
    }
    // 检测相对路径中的 .. 穿越
    else if (part.includes('..')) {
      paths.push(part)
    }
  }

  return paths
}

/**
 * 验证命令是否安全
 * 拦截敏感操作（根据权限配置）
 */
export function validateCommand(command: string): { safe: boolean; error?: string } {
  const trimmed = command.trim()
  const config = loadSandboxConfig()

  // 检查自定义允许前缀（优先级最高）
  for (const prefix of config.allowedCommandPrefixes) {
    if (trimmed.startsWith(prefix)) {
      return { safe: true }
    }
  }

  // 检查自定义拒绝模式
  for (const pattern of config.deniedCommandPatterns) {
    try {
      const regex = new RegExp(pattern)
      if (regex.test(trimmed)) {
        return { safe: false, error: `自定义规则拒绝: ${pattern}` }
      }
    } catch {
      // 忽略无效的正则
    }
  }

  // 1. 检查绝对路径访问（包括 ls /）
  if (!hasPermission('absolute_paths')) {
    const absolutePathPatterns = [
      /\s+\/\s*$/,           // ls / 或 cd /
      /\s+\/[a-zA-Z]/,      // ls /home, cat /etc/passwd
      /^\//,                 // 以 / 开头的命令
    ]

    for (const pattern of absolutePathPatterns) {
      if (pattern.test(trimmed)) {
        const paths = extractPaths(trimmed)
        for (const path of paths) {
          const validation = validatePath(path)
          if (!validation.valid) {
            return { safe: false, error: `禁止访问工作区外的路径: ${path}` }
          }
        }
      }
    }
  }

  // 2. 检查环境变量泄露
  if (!hasPermission('env_vars')) {
    const envVarPatterns = [
      /\$\{?HOME\}?/,
      /\$\{?USER\}?/,
      /\$\{?SHELL\}?/,
      /\$\{?PATH\}?/,
      /\$\{?HOSTNAME\}?/,
      /\$\{?PWD\}?/,
      /\$\{?LANG\}?/,
      /\$\{?TERM\}?/,
    ]

    for (const pattern of envVarPatterns) {
      if (pattern.test(trimmed)) {
        return { safe: false, error: '禁止访问环境变量' }
      }
    }
  }

  // 3. 检查网络访问
  if (!hasPermission('network')) {
    const networkPatterns = [
      /\bcurl\b/,
      /\bwget\b/,
      /\bssh\b/,
      /\bscp\b/,
      /\brsync\b/,
      /\bftp\b/,
      /\btelnet\b/,
      /\bnetcat\b/,
      /\bnc\b/,
    ]

    for (const pattern of networkPatterns) {
      if (pattern.test(trimmed)) {
        return { safe: false, error: '禁止网络访问' }
      }
    }
  }

  // 4. 检查进程操作
  if (!hasPermission('process')) {
    const processPatterns = [
      /\bkill\b/,
      /\bpkill\b/,
      /\bkillall\b/,
      /\bnohup\b/,
      /\bdetach\b/,
    ]

    for (const pattern of processPatterns) {
      if (pattern.test(trimmed)) {
        return { safe: false, error: '禁止进程操作' }
      }
    }
  }

  // 5. 检查用户目录访问
  if (!hasPermission('user_dirs')) {
    const homeDirPatterns = [
      /\s+~\//,
      /\s+\$HOME\//,
      /\s+\/home\//,
    ]

    for (const pattern of homeDirPatterns) {
      if (pattern.test(trimmed)) {
        return { safe: false, error: '禁止访问用户目录' }
      }
    }
  }

  // 6. 检查父目录穿越
  if (!hasPermission('parent_traversal') && trimmed.includes('..')) {
    return { safe: false, error: '禁止使用 .. 穿越目录' }
  }

  // 7. 检查系统目录访问
  if (!hasPermission('system_dirs')) {
    const systemDirPatterns = [
      /\s+\/etc\//,
      /\s+\/usr\//,
      /\s+\/var\//,
      /\s+\/root\//,
      /\s+\/boot\//,
      /\s+\/dev\//,
      /\s+\/proc\//,
      /\s+\/sys\//,
    ]

    for (const pattern of systemDirPatterns) {
      if (pattern.test(trimmed)) {
        return { safe: false, error: '禁止访问系统目录' }
      }
    }
  }

  return { safe: true }
}

/**
 * 获取工作区根目录
 */
export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT
}

/**
 * 获取当前配置的摘要
 */
export function getSandboxConfigSummary(): string {
  const config = loadSandboxConfig()
  const lines: string[] = [
    '沙箱配置:',
    `  启用权限: ${config.enabled.length > 0 ? config.enabled.join(', ') : '无'}`,
    `  禁用权限: ${config.disabled.length > 0 ? config.disabled.join(', ') : '无'}`,
  ]

  if (config.allowedCommandPrefixes.length > 0) {
    lines.push(`  自定义允许命令前缀: ${config.allowedCommandPrefixes.join(', ')}`)
  }
  if (config.allowedPathPrefixes.length > 0) {
    lines.push(`  自定义允许路径前缀: ${config.allowedPathPrefixes.join(', ')}`)
  }
  if (config.deniedCommandPatterns.length > 0) {
    lines.push(`  自定义拒绝模式: ${config.deniedCommandPatterns.join(', ')}`)
  }

  return lines.join('\n')
}
