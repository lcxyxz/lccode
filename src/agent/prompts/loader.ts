/**
 * 提示词模板加载器
 * 模板由 scripts/build.ts 预编译进 templates.generated.ts，
 * 编译单文件时自动打进产物，开发模式同样可用，无需运行时读盘
 */

import { TEMPLATES } from './templates.generated.js'

const cache: Record<string, string> = {}

function load(name: string): string {
  if (cache[name] === undefined) {
    const content = TEMPLATES[name]
    if (content === undefined) throw new Error(`Template not found: ${name}`)
    cache[name] = content
  }
  return cache[name]
}

/**
 * 变量插值：将 {{变量名}} 替换为实际值
 */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ===================== 系统提示词 =====================

export function getSystemPrompt(): string {
  return load('system-prompt')
}

// ===================== 重试消息 =====================

export function getRetryMessage(): string {
  return load('retry-message')
}

// ===================== 解析提示 =====================

const HINT_PATTERN = /<!-- hint:(\w+) -->\n([\s\S]*?)(?=<!-- hint:|$)/g

function loadHints(): Record<string, string> {
  const raw = load('parse-hints')
  const hints: Record<string, string> = {}
  let match: RegExpExecArray | null
  while ((match = HINT_PATTERN.exec(raw)) !== null) {
    hints[match[1]] = match[2].trim()
  }
  return hints
}

let parsedHints: Record<string, string> | null = null

function getHint(name: string): string {
  if (!parsedHints) parsedHints = loadHints()
  return parsedHints[name] ?? ''
}

export const PARSE_HINTS = {
  noJsonTag: () => getHint('noJsonTag'),
  jsonSyntax: () => getHint('jsonSyntax'),
  missingType: () => getHint('missingType'),
  missingRoundAction: () => getHint('missingRoundAction'),
  toolCallMissingTool: () => getHint('toolCallMissingTool'),
  toolCallMissingParams: () => getHint('toolCallMissingParams'),
  finalAnswerMissingAnswer: () => getHint('finalAnswerMissingAnswer'),
  clarificationMissingQuestion: () => getHint('clarificationMissingQuestion'),
  errorMissingError: () => getHint('errorMissingError'),
  unknownType: () => getHint('unknownType'),
} as const
