import React from 'react'
import { parse, setOptions } from 'marked'
import { Text } from 'ink'
import TerminalRenderer from 'marked-terminal'

interface MarkdownProps {
  children: string
}

export default function Markdown({ children }: MarkdownProps) {
  setOptions({ renderer: new (TerminalRenderer as any)() })
  const result = parse(children)
  return <Text>{(typeof result === 'string' ? result : '').trim()}</Text>
}
