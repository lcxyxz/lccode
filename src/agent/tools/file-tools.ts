import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, rmSync, readdirSync, type Dirent } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { diffLines } from 'diff'
import type { Tool, ToolResult, DiffLine } from './tool-registry.js'
import { validatePath, getWorkspaceRoot } from '../../utils/sandbox.js'

/**
 * 检测内容是否包含无法用 UTF-8 解码的字符（可能是 GBK 等其他编码）
 */
function hasUndecodableChars(content: string): boolean {
  return content.includes('\uFFFD')
}

/**
 * Compute diff between two texts
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
 * Get language from file extension
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
 * Read file content
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read file content, supports line range filtering',
  parameters: [
    { name: 'file_path', type: 'string', description: 'absolute or relative file path', required: true },
    { name: 'start_line', type: 'number', description: 'Start line (1-based), defaults to start of file', required: false },
    { name: 'end_line', type: 'number', description: 'End line (inclusive), defaults to end of file', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.file_path

      // Path validation: prevent out-of-bounds access
      const validation = validatePath(filePath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `File not found: ${filePath}` }
      }

      const content = readFileSync(validation.resolved!, 'utf-8')
      if (hasUndecodableChars(content)) {
        return { success: false, output: '', error: `File is not valid UTF-8 (possibly GBK or another encoding, cannot be read safely): ${filePath}` }
      }
      const lines = content.split('\n')

      const start = params.start_line ? Math.max(1, Number(params.start_line)) : 1
      const end = params.end_line ? Math.min(lines.length, Number(params.end_line)) : lines.length

      if (start > lines.length) {
        return { success: false, output: '', error: `Start line ${start} exceeds total lines ${lines.length}` }
      }

      const selected = lines.slice(start - 1, end)
      const output = selected
        .map((line, i) => `${String(start + i).padStart(4)}: ${line}`)
        .join('\n')

      return {
        success: true,
        output: output + `\n--- ${lines.length} lines, showing ${start}-${end} ---`,
      }
    } catch (error: any) {
      return { success: false, output: '', error: `Read failed: ${error.message}` }
    }
  },
}

/**
 * Write file content (create or overwrite)
 */
export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create new file or overwrite existing file content',
  parameters: [
    { name: 'file_path', type: 'string', description: 'absolute or relative file path', required: true },
    { name: 'content', type: 'string', description: 'Full file content to write', required: true },
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
          error: `Confirm: target ${filePath} is outside the workspace, continue?`,
        }
      }

      // Auto-create parent dir
      const dir = dirname(validation.resolved!)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(validation.resolved!, content, 'utf-8')
      return { success: true, output: `Written: ${filePath} (${content.length} bytes)` }
    } catch (error: any) {
      return { success: false, output: '', error: `Write failed: ${error.message}` }
    }
  },
}

/**
 * Precisely edit file
 */
export const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Precisely edit file: replace by line range or string match',
  parameters: [
    { name: 'file_path', type: 'string', description: 'absolute or relative file path', required: true },
    { name: 'old_text', type: 'string', description: 'Original text to replace (exact match)', required: false },
    { name: 'new_text', type: 'string', description: 'Replacement text', required: true },
    { name: 'start_line', type: 'number', description: 'Start line of replacement range (with end_line)', required: false },
    { name: 'end_line', type: 'number', description: 'End line of replacement range (inclusive)', required: false },
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
          error: `Confirm: edit target ${filePath} is outside the workspace, continue?`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `File not found: ${filePath}` }
      }

      const content = readFileSync(validation.resolved!, 'utf-8')
      if (hasUndecodableChars(content)) {
        return { success: false, output: '', error: `File is not valid UTF-8 (possibly GBK or another encoding, edit would corrupt it): ${filePath}` }
      }
      const lines = content.split('\n')
      const language = getLanguageFromPath(filePath)

      // Mode 1: replace by line range
      if (params.start_line && params.end_line) {
        const start = Number(params.start_line)
        const end = Number(params.end_line)

        if (start < 1 || end > lines.length || start > end) {
          return {
            success: false,
            output: '',
            error: `Invalid line range: ${start}-${end} (file has ${lines.length} lines)`,
          }
        }

        const oldSection = lines.slice(start - 1, end).join('\n')
        const newLines = params.new_text.split('\n')
        lines.splice(start - 1, end - start + 1, ...newLines)
        writeFileSync(validation.resolved!, lines.join('\n'), 'utf-8')

        const diffLines = computeDiff(oldSection, params.new_text)

        return {
          success: true,
          output: `Replaced lines ${start}-${end} with new content (${newLines.length} lines)`,
          diff: {
            filePath,
            language,
            lines: diffLines,
          },
        }
      }

      // Mode 2: replace by string match
      if (params.old_text) {
        if (!content.includes(params.old_text)) {
          return {
            success: false,
            output: '',
            error: `Text to replace not found: "${params.old_text.slice(0, 80)}${params.old_text.length > 80 ? '...' : ''}"`,
          }
        }

        const newContent = content.replace(params.old_text, params.new_text)
        writeFileSync(validation.resolved!, newContent, 'utf-8')

        const diffLines = computeDiff(params.old_text, params.new_text)

        return {
          success: true,
          output: `Replaced matching text`,
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
        error: 'Provide old_text (string replace) or start_line + end_line (line range replace)',
      }
    } catch (error: any) {
      return { success: false, output: '', error: `Edit failed: ${error.message}` }
    }
  },
}

/**
 * Delete file
 */
export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete specified file',
  parameters: [
    { name: 'file_path', type: 'string', description: 'Path of file to delete', required: true },
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
          error: `Confirm: delete target ${filePath} is outside the workspace, continue?`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `File not found: ${filePath}` }
      }

      const stat = statSync(validation.resolved!)
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `This is a directory, cannot delete with delete_file: ${filePath}` }
      }

      unlinkSync(validation.resolved!)
      return { success: true, output: `Deleted file: ${filePath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `Delete failed: ${error.message}` }
    }
  },
}

/**
 * Delete folder
 */
export const deleteDirectoryTool: Tool = {
  name: 'delete_directory',
  description: 'Delete folder and all its contents (recursive)',
  parameters: [
    { name: 'dir_path', type: 'string', description: 'Path of folder to delete', required: true },
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
          error: `Confirm: delete target ${dirPath} is outside the workspace, continue?`,
        }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `Folder not found: ${dirPath}` }
      }

      const stat = statSync(validation.resolved!)
      if (!stat.isDirectory()) {
        return { success: false, output: '', error: `This is a file, cannot delete with delete_directory: ${dirPath}` }
      }

      rmSync(validation.resolved!, { recursive: true, force: true })
      return { success: true, output: `Deleted folder: ${dirPath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `Delete failed: ${error.message}` }
    }
  },
}

// ===================== Search and Directory Tools =====================

/** Directories to skip */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__', '.next', '.nuxt'])

/**
 * Convert glob pattern to regex
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
  // Without wildcards, use substring match
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, 'i')
}

/**
 * Recursively search file content (cross-platform grep replacement)
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
        if (hasUndecodableChars(content)) continue
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
        // Skip binary or unreadable files
      }
    }
  }
}

/**
 * Recursively search file names (cross-platform find replacement)
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
 * Cross-platform search tool (grep/find replacement)
 * Content search uses regex, file search uses glob matching
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Cross-platform search: content (grep replacement) and file name (find/dir replacement). Prefer over execute_command for searching',
  parameters: [
    { name: 'query', type: 'string', description: 'Search keyword (regex for content search, wildcards like *.ts for file search)', required: true },
    { name: 'path', type: 'string', description: 'Directory to search, defaults to current directory', required: false },
    { name: 'file_pattern', type: 'string', description: 'File type filter, e.g. "*.ts" or "*.ts,*.js"', required: false },
    { name: 'type', type: 'string', description: 'Search type: "content" for file content (default), "files" for file names', required: false },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const query = params.query
      const searchPath = params.path || '.'
      const filePattern = params.file_pattern
      const searchType = params.type || 'content'
      const cwd = getWorkspaceRoot()

      // Path validation: prevent out-of-bounds access
      const validation = validatePath(searchPath)
      if (!validation.valid) {
        return { success: false, output: '', error: validation.error }
      }

      if (!existsSync(validation.resolved!)) {
        return { success: false, output: '', error: `Path not found: ${searchPath}` }
      }

      const results: string[] = []

      if (searchType === 'files') {
        // File name search
        searchFiles(validation.resolved!, query, results, 200, cwd)
        const output = results.length > 0
          ? `Found ${results.length} files:\n${results.join('\n')}`
          : 'No matching files found'
        return { success: true, output }
      }

      // Content search
      // Support comma-separated multiple file types
      const patterns = filePattern ? filePattern.split(',').map((s: string) => s.trim()) : undefined

      if (patterns && patterns.length > 1) {
        for (const pat of patterns) {
          searchContent(validation.resolved!, query, pat, results, 500, cwd)
        }
      } else {
        searchContent(validation.resolved!, query, filePattern, results, 500, cwd)
      }

      const output = results.length > 0
        ? `Found ${results.length} matches:\n${results.join('\n')}`
        : 'No matching content found'
      return { success: true, output }
    } catch (error: any) {
      return { success: false, output: '', error: `Search failed: ${error.message}` }
    }
  },
}

/**
 * Create folder tool (mkdir replacement)
 */
export const addDirTool: Tool = {
  name: 'add_dir',
  description: 'Create folder (recursive). Prefer over execute_command for mkdir',
  parameters: [
    { name: 'dir_path', type: 'string', description: 'Path of folder to create', required: true },
    { name: 'recursive', type: 'boolean', description: 'Recursively create parent dirs, default true', required: false },
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
          error: `Confirm: create target ${dirPath} is outside the workspace, continue?`,
        }
      }

      if (existsSync(validation.resolved!)) {
        const stat = statSync(validation.resolved!)
        if (stat.isDirectory()) {
          return { success: true, output: `Folder already exists: ${dirPath}` }
        }
        return { success: false, output: '', error: `Path exists but is not a folder: ${dirPath}` }
      }

      mkdirSync(validation.resolved!, { recursive })
      return { success: true, output: `Created folder: ${dirPath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `Create folder failed: ${error.message}` }
    }
  },
}
