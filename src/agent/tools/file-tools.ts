import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, rmSync, readdirSync, type Dirent } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { diffLines } from 'diff'
import type { Tool, ToolResult, DiffLine } from './tool-registry.js'
import { validatePath, getWorkspaceRoot } from '../../utils/sandbox.js'

/**
 * 计算两段文本的差异
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const changes = diffLines(oldText, newText)
  const result: DiffLine[] = []
  let oldLineNum = 1
  let newLineNum = 1

  for (const part of changes) {
    const lines = part.value.split('\n')
    if (lines[lines.length - 1] === '') lines.pop()

    for (const line of lines) {
      if (part.added) {
        result.push({ type: 'added', lineNumber: newLineNum, content: line })
        newLineNum++
      } else if (part.removed) {
        result.push({ type: 'removed', lineNumber: oldLineNum, content: line })
        oldLineNum++
      } else {
        result.push({ type: 'unchanged', lineNumber: newLineNum, content: line })
        oldLineNum++
        newLineNum++
      }
    }
  }

  return result
}

/**
 * 根据文件扩展名获取语言
 */
function getLanguageFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.cmd': 'batch',
  }
  return langMap[ext] || 'text'
}

/**
 * 读取文件内容
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: '读取指定文件的内容，支持行范围过滤',
  parameters: [
    { name: 'file_path', type: 'string', description: '文件的绝对路径或相对路径', required: true },
    { name: 'start_line', type: 'number', description: '起始行号（从 1 开始），默认从头读取', required: false },
    { name: 'end_line', type: 'number', description: '结束行号（包含），默认读到文件末尾', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.file_path

      // 路径验证：防止越界访问
      const validation = validatePath(filePath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const content = readFileSync(validation.resolved!, 'utf-8')
      const lines = content.split('\n')

      const start = params.start_line ? Math.max(1, Number(params.start_line)) : 1
      const end = params.end_line ? Math.min(lines.length, Number(params.end_line)) : lines.length

      if (start > lines.length) {
        return { success: false, output: '', error: `起始行 ${start} 超过文件总行数 ${lines.length}` }
      }

      const selected = lines.slice(start - 1, end)
      const output = selected
        .map((line, i) => `${String(start + i).padStart(4)}: ${line}`)
        .join('\n')

      return {
        success: true,
        output: output + `\n--- 共 ${lines.length} 行，显示第 ${start}-${end} 行 ---`,
      }
    } catch (error: any) {
      return { success: false, output: '', error: `读取失败: ${error.message}` }
    }
  },
}

/**
 * 写入文件内容（创建或覆盖）
 */
export const writeFileTool: Tool = {
  name: 'write_file',
  description: '创建新文件或覆盖已有文件的内容',
  parameters: [
    { name: 'file_path', type: 'string', description: '文件的绝对路径或相对路径', required: true },
    { name: 'content', type: 'string', description: '要写入的完整文件内容', required: true },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.file_path
      const content = params.content

      const validation = validatePath(filePath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (validation.outsideWorkspace) {
        return {
          success: false,
          output: '',
          error: `需要确认: 操作目标 ${filePath} 不在当前工作区内，是否继续？`,
        }
      }

      // 自动创建父目录
      const dir = dirname(validation.resolved!)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(validation.resolved!, content, 'utf-8')
      return { success: true, output: `已写入文件: ${filePath} (${content.length} 字节)` }
    } catch (error: any) {
      return { success: false, output: '', error: `写入失败: ${error.message}` }
    }
  },
}

/**
 * 精确编辑文件
 */
export const editFileTool: Tool = {
  name: 'edit_file',
  description: '精确编辑文件：支持按行范围替换或按字符串查找替换',
  parameters: [
    { name: 'file_path', type: 'string', description: '文件的绝对路径或相对路径', required: true },
    { name: 'old_text', type: 'string', description: '要被替换的原始文本（精确匹配）', required: false },
    { name: 'new_text', type: 'string', description: '替换后的新文本', required: true },
    { name: 'start_line', type: 'number', description: '替换范围起始行号（与 end_line 配合使用）', required: false },
    { name: 'end_line', type: 'number', description: '替换范围结束行号（包含）', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.file_path

      const validation = validatePath(filePath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (validation.outsideWorkspace) {
        return {
          success: false,
          output: '',
          error: `需要确认: 编辑目标 ${filePath} 不在当前工作区内，是否继续？`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const content = readFileSync(validation.resolved!, 'utf-8')
      const lines = content.split('\n')
      const language = getLanguageFromPath(filePath)

      // 模式1：按行范围替换
      if (params.start_line && params.end_line) {
        const start = Number(params.start_line)
        const end = Number(params.end_line)

        if (start < 1 || end > lines.length || start > end) {
          return {
            success: false,
            output: '',
            error: `无效的行范围: ${start}-${end}（文件共 ${lines.length} 行）`,
          }
        }

        const oldSection = lines.slice(start - 1, end).join('\n')
        const newLines = params.new_text.split('\n')
        lines.splice(start - 1, end - start + 1, ...newLines)
        writeFileSync(validation.resolved!, lines.join('\n'), 'utf-8')

        const diffLines = computeDiff(oldSection, params.new_text)

        return {
          success: true,
          output: `已替换第 ${start}-${end} 行为新内容（${newLines.length} 行）`,
          diff: {
            filePath,
            language,
            lines: diffLines,
          },
        }
      }

      // 模式2：按字符串查找替换
      if (params.old_text) {
        if (!content.includes(params.old_text)) {
          return {
            success: false,
            output: '',
            error: `未找到要替换的文本: "${params.old_text.slice(0, 80)}${params.old_text.length > 80 ? '...' : ''}"`,
          }
        }

        const newContent = content.replace(params.old_text, params.new_text)
        writeFileSync(validation.resolved!, newContent, 'utf-8')

        const diffLines = computeDiff(params.old_text, params.new_text)

        return {
          success: true,
          output: `已替换匹配的文本`,
          diff: {
            filePath,
            language,
            lines: diffLines,
          },
        }
      }

      return {
        success: false,
        output: '',
        error: '请提供 old_text（字符串替换）或 start_line + end_line（行范围替换）',
      }
    } catch (error: any) {
      return { success: false, output: '', error: `编辑失败: ${error.message}` }
    }
  },
}

/**
 * 删除文件
 */
export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: '删除指定文件',
  parameters: [
    { name: 'file_path', type: 'string', description: '要删除的文件路径', required: true },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.file_path

      const validation = validatePath(filePath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (validation.outsideWorkspace) {
        return {
          success: false,
          output: '',
          error: `需要确认: 删除目标 ${filePath} 不在当前工作区内，是否继续？`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const stat = statSync(validation.resolved!)
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `这是一个目录，不能用 delete_file 删除: ${filePath}` }
      }

      unlinkSync(validation.resolved!)
      return { success: true, output: `已删除文件: ${filePath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `删除失败: ${error.message}` }
    }
  },
}

/**
 * 删除文件夹
 */
export const deleteDirectoryTool: Tool = {
  name: 'delete_directory',
  description: '删除指定文件夹及其所有内容（递归删除）',
  parameters: [
    { name: 'dir_path', type: 'string', description: '要删除的文件夹路径', required: true },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const dirPath = params.dir_path

      const validation = validatePath(dirPath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (validation.outsideWorkspace) {
        return {
          success: false,
          output: '',
          error: `需要确认: 删除目标 ${dirPath} 不在当前工作区内，是否继续？`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `文件夹不存在: ${dirPath}` }
      }

      const stat = statSync(validation.resolved!)
      if (!stat.isDirectory()) {
        return { success: false, output: '', error: `这是一个文件，不能用 delete_directory 删除: ${dirPath}` }
      }

      rmSync(validation.resolved!, { recursive: true, force: true })
      return { success: true, output: `已删除文件夹: ${dirPath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `删除失败: ${error.message}` }
    }
  },
}

// ===================== 搜索和目录工具 =====================

/** 需要跳过的目录 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__', '.next', '.nuxt'])

/**
 * 将 glob 模式转为正则
 */
function globToRegex(pattern: string): RegExp {
  const hasWildcard = pattern.includes('*') || pattern.includes('?')
  if (hasWildcard) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${escaped}$`, 'i')
  }
  // 无通配符时，使用包含匹配
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, 'i')
}

/**
 * 递归搜索文件内容（跨平台 grep 替代）
 */
function searchContent(
  dir: string,
  query: string,
  filePattern: string | undefined,
  results: string[],
  maxResults: number,
  cwd: string,
): void {
  if (results.length >= maxResults) return

  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  const queryRegex = new RegExp(query, 'gi')

  for (const entry of entries) {
    if (results.length >= maxResults) break
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      searchContent(fullPath, query, filePattern, results, maxResults, cwd)
    } else if (entry.isFile()) {
      if (filePattern) {
        const regex = globToRegex(filePattern)
        if (!regex.test(entry.name)) continue
      }

      try {
        const content = readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (queryRegex.test(lines[i])) {
            const relPath = relative(cwd, fullPath)
            results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`)
            queryRegex.lastIndex = 0
            if (results.length >= maxResults) break
          }
        }
      } catch {
        // 跳过二进制文件或不可读文件
      }
    }
  }
}

/**
 * 递归搜索文件名（跨平台 find 替代）
 */
function searchFiles(
  dir: string,
  pattern: string,
  results: string[],
  maxResults: number,
  cwd: string,
): void {
  if (results.length >= maxResults) return

  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  const regex = globToRegex(pattern)

  for (const entry of entries) {
    if (results.length >= maxResults) break
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      searchFiles(fullPath, pattern, results, maxResults, cwd)
    } else if (entry.isFile() && regex.test(entry.name)) {
      results.push(relative(cwd, fullPath))
    }
  }
}

/**
 * 跨平台搜索工具（替代 grep/find 命令）
 * 内容搜索底层基于正则匹配，文件搜索基于 glob 匹配
 */
export const searchTool: Tool = {
  name: 'search',
  description: '跨平台搜索：支持内容搜索（替代 grep）和文件名搜索（替代 find/dir）。优先使用此工具而非 execute_command 进行搜索',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词（内容搜索时支持正则表达式，文件搜索时支持通配符如 *.ts）', required: true },
    { name: 'path', type: 'string', description: '搜索目录路径，默认当前目录', required: false },
    { name: 'file_pattern', type: 'string', description: '文件类型过滤，如 "*.ts" 或 "*.ts,*.js"', required: false },
    { name: 'type', type: 'string', description: '搜索类型: "content" 搜索文件内容（默认），"files" 搜索文件名', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const query = params.query
      const searchPath = params.path || '.'
      const filePattern = params.file_pattern
      const searchType = params.type || 'content'
      const cwd = getWorkspaceRoot()

      // 路径验证：防止越界访问
      const validation = validatePath(searchPath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `路径不存在: ${searchPath}` }
      }

      const results: string[] = []

      if (searchType === 'files') {
        // 文件名搜索
        searchFiles(validation.resolved!, query, results, 200, cwd)
        const output = results.length > 0
          ? `找到 ${results.length} 个文件：\n${results.join('\n')}`
          : '未找到匹配的文件'
        return { success: true, output }
      }

      // 内容搜索
      // 支持逗号分隔的多文件类型
      const patterns = filePattern ? filePattern.split(',').map((s: string) => s.trim()) : undefined

      if (patterns && patterns.length > 1) {
        for (const pat of patterns) {
          searchContent(validation.resolved!, query, pat, results, 500, cwd)
        }
      } else {
        searchContent(validation.resolved!, query, filePattern, results, 500, cwd)
      }

      const output = results.length > 0
        ? `找到 ${results.length} 处匹配：\n${results.join('\n')}`
        : '未找到匹配内容'
      return { success: true, output }
    } catch (error: any) {
      return { success: false, output: '', error: `搜索失败: ${error.message}` }
    }
  },
}

/**
 * 创建文件夹工具（替代 mkdir 命令）
 */
export const addDirTool: Tool = {
  name: 'add_dir',
  description: '创建文件夹（支持递归创建父目录）。优先使用此工具而非 execute_command 执行 mkdir',
  parameters: [
    { name: 'dir_path', type: 'string', description: '要创建的文件夹路径', required: true },
    { name: 'recursive', type: 'boolean', description: '是否递归创建父目录，默认 true', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const dirPath = params.dir_path
      const recursive = params.recursive !== false

      const validation = validatePath(dirPath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (validation.outsideWorkspace) {
        return {
          success: false,
          output: '',
          error: `需要确认: 创建目标 ${dirPath} 不在当前工作区内，是否继续？`,
        }
      }

      if (existsSync(validation.resolved!)) {
        const stat = statSync(validation.resolved!)
        if (stat.isDirectory()) {
          return { success: true, output: `文件夹已存在: ${dirPath}` }
        }
        return { success: false, output: '', error: `路径已存在但不是文件夹: ${dirPath}` }
      }

      mkdirSync(validation.resolved!, { recursive })
      return { success: true, output: `已创建文件夹: ${dirPath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `创建文件夹失败: ${error.message}` }
    }
  },
}
