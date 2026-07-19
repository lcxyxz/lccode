/**
 * Skill 类型定义
 */

/** 单个 Skill 的元信息 + 内容 */
export interface Skill {
  /** 文件名（不含 .md 后缀），即 skill 的唯一标识 */
  name: string
  /** 用户自定义的简短描述，用于帮助文本和匹配 */
  description: string
  /** 触发此 skill 的关键词列表（可选，用于自动匹配） */
  triggers?: string[]
  /** skill 的完整 Markdown 指令内容 */
  content: string
  /** skill 文件的原始路径 */
  filePath: string
}
