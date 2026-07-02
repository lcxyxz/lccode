/**
 * 语言检测工具
 * 根据文件扩展名检测编程语言
 */

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.html': 'html', '.htm': 'html', '.xml': 'xml',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown', '.sql': 'sql', '.sh': 'bash', '.bash': 'bash',
  '.vue': 'html', '.svelte': 'html',
}

/**
 * 根据文件路径检测编程语言
 * @param filePath 文件路径
 * @returns 语言名称，默认返回 'text'
 */
export function detectLanguage(filePath: string): string {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase()
  return EXTENSION_LANGUAGE[ext] || 'text'
}
