---
description: Debug common Ink framework issues with input handling, IME, cursor, and rendering
---

# Ink Framework Debugging

Debug common Ink framework issues based on discovered patterns from this project.

## Common Issues and Solutions

### 1. IME Input Not Working
**Problem**: Chinese input (IME) doesn't work with Ink's `useInput` hook.

**Solution**: Use `useStdin` with raw mode instead:
```typescript
import { useStdin } from 'ink'

const { stdin, setRawMode } = useStdin()

useEffect(() => {
  setRawMode(true)
  stdin.on('data', (data) => {
    const str = data.toString()
    // Handle IME input
  })
  return () => {
    setRawMode(false)
  }
}, [])
```

### 2. Backspace Not Working
**Problem**: Backspace key doesn't delete characters reliably.

**Solution**: Handle ASCII 127/8 in raw input:
```typescript
if (str === '\x7f' || str === '\x08') {
  // Handle backspace
  return
}
```

### 3. Cursor Position Issues
**Problem**: Cursor doesn't follow input correctly.

**Solution**: Track cursor position separately:
```typescript
const [cursorPosition, setCursorPosition] = useState(0)
// Update on each input event
```

### 4. Auto-scroll in Visual Mode
**Problem**: Pressing any key in visual mode scrolls to bottom.

**Solution**: Don't modify refs in render path:
```typescript
// BAD: Setting ref in render function
const getVisibleSections = () => {
  if (isAtBottom) autoScrollRef.current = true // This causes loops!
  return sections
}

// GOOD: Use explicit state for scroll targets
const [scrollTarget, setScrollTarget] = useState<string | null>(null)
```

### 5. useStdoutDimensions Not Available
**Problem**: `useStdoutDimensions` is not exported from ink.

**Solution**: Use `process.stdout.columns` directly:
```typescript
const width = process.stdout.columns || 80
```

### 6. JSX Namespace Not Found
**Problem**: `Cannot find namespace 'JSX'`.

**Solution**: Import React:
```typescript
import React from 'react'
// Use React.ReactElement[] instead of JSX.Element[]
```

### 7. Type Mismatches
**Problem**: Union type mismatches (e.g., `string` vs specific union).

**Solution**: Import the type and use it:
```typescript
import type { OutputSection } from '../types'
// Use OutputSection['color'] instead of string
```

## Debugging Tips

1. Use `process.stderr.write` for debug logs (Ink uses stdout for UI)
2. Check React 18 batch processing - refs set synchronously may not be visible in next updater
3. Avoid setting refs in render paths - causes infinite loops
4. Use ref bridges when hooks have circular dependencies

## Testing

After fixing issues, verify:
```bash
npx tsc --noEmit 2>&1
npm run build
```
