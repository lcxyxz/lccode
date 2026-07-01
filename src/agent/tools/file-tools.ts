import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Tool, ToolResult } from './tool-registry.js'

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
      if (!existsSync(filePath)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const content = readFileSync(filePath, 'utf-8')
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

      // 自动创建父目录
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(filePath, content, 'utf-8')
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
      if (!existsSync(filePath)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

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

        const newLines = params.new_text.split('\n')
        lines.splice(start - 1, end - start + 1, ...newLines)
        writeFileSync(filePath, lines.join('\n'), 'utf-8')

        return {
          success: true,
          output: `已替换第 ${start}-${end} 行为新内容（${newLines.length} 行）`,
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
        writeFileSync(filePath, newContent, 'utf-8')

        return { success: true, output: `已替换匹配的文本` }
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

      if (!existsSync(filePath)) {
        return { success: false, output: '', error: `文件不存在: ${filePath}` }
      }

      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `这是一个目录，不能用 delete_file 删除: ${filePath}` }
      }

      unlinkSync(filePath)
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

      if (!existsSync(dirPath)) {
        return { success: false, output: '', error: `文件夹不存在: ${dirPath}` }
      }

      const stat = statSync(dirPath)
      if (!stat.isDirectory()) {
        return { success: false, output: '', error: `这是一个文件，不能用 delete_directory 删除: ${dirPath}` }
      }

      rmSync(dirPath, { recursive: true, force: true })
      return { success: true, output: `已删除文件夹: ${dirPath}` }
    } catch (error: any) {
      return { success: false, output: '', error: `删除失败: ${error.message}` }
    }
  },
}
