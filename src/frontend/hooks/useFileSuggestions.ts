import { useState, useCallback, useRef } from 'react'
import { readdirSync, type Dirent } from 'node:fs'
import { join, relative } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__', '.next', '.nuxt', '.lccode', '.mimocode'])

export interface FileMatch {
  path: string
  name: string
}

function searchFiles(dir: string, query: string, results: FileMatch[], maxResults: number, cwd: string, depth = 0): void {
  if (results.length >= maxResults || depth > 3) return

  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as Dirent[]
  } catch {
    return
  }

  const q = query.toLowerCase()

  for (const entry of entries) {
    if (results.length >= maxResults) break
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)
    const relPath = relative(cwd, fullPath)

    if (entry.isDirectory()) {
      if (!query || entry.name.toLowerCase().includes(q)) {
        results.push({ path: relPath + '/', name: entry.name })
      }
      searchFiles(fullPath, query, results, maxResults, cwd, depth + 1)
    } else if (entry.isFile()) {
      if (!query || entry.name.toLowerCase().includes(q)) {
        results.push({ path: relPath, name: entry.name })
      }
    }
  }
}

function detectAtTrigger(input: string): { triggered: boolean; query: string; startIndex: number } {
  const i = input.lastIndexOf('@')
  if (i === -1) return { triggered: false, query: '', startIndex: -1 }
  if (i > 0 && input[i - 1] !== ' ') return { triggered: false, query: '', startIndex: -1 }
  const query = input.slice(i + 1)
  if (query.includes(' ')) return { triggered: false, query: '', startIndex: -1 }
  return { triggered: true, query, startIndex: i }
}

export function useFileSuggestions() {
  const [show, setShow] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [files, setFiles] = useState<FileMatch[]>([])
  const [trigger, setTrigger] = useState<{ startIndex: number; query: string } | null>(null)

  const filesRef = useRef(files)
  filesRef.current = files
  const indexRef = useRef(selectedIndex)
  indexRef.current = selectedIndex
  const triggerRef = useRef(trigger)
  triggerRef.current = trigger

  const cwd = process.cwd()

  const updateInput = useCallback((input: string) => {
    const { triggered, query, startIndex } = detectAtTrigger(input)
    if (triggered) {
      setTrigger({ startIndex, query })
      setShow(true)
      setSelectedIndex(0)
      const results: FileMatch[] = []
      searchFiles(cwd, query, results, 20, cwd)
      setFiles(results)
    } else {
      setShow(false)
      setTrigger(null)
      setFiles([])
    }
  }, [cwd])

  const selectUp = useCallback(() => setSelectedIndex(i => Math.max(0, i - 1)), [])
  const selectDown = useCallback(() => setSelectedIndex(i => Math.min(filesRef.current.length - 1, i + 1)), [])
  const getSelected = useCallback((): FileMatch | null => filesRef.current[indexRef.current] || null, [])
  const dismiss = useCallback(() => { setShow(false); setTrigger(null) }, [])

  const insertFile = useCallback((input: string, file: FileMatch): string => {
    if (!triggerRef.current) return input
    const { startIndex } = triggerRef.current
    return input.slice(0, startIndex) + file.path + input.slice(startIndex).replace(/^@[^\s]*/, '')
  }, [])

  return { show, selectedIndex, files, updateInput, selectUp, selectDown, getSelected, dismiss, insertFile }
}
