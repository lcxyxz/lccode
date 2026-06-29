---
description: Identify and remove unused code, empty files, and dead exports from the codebase
---

# Dead Code Cleanup

Systematically identify and remove unused code, empty files, and dead exports.

## Steps

### 1. Find Empty Files
```bash
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -empty
```

### 2. Find Unused Exports
Search for exported functions/variables that are never imported elsewhere:
- Use grep to find all exports in a file
- Use grep to check if each export is imported anywhere else
- Common patterns: unused hook returns, unused utility functions

### 3. Find Unused Imports
Search for import statements that import symbols never used in the file.

### 4. Clean Up
For each identified dead code:
1. Remove the unused export/import
2. Delete empty files
3. Update any re-exports in index files

### 5. Verify
Run TypeScript compilation to ensure no regressions:
```bash
npx tsc --noEmit 2>&1
```

## Common Patterns in This Project

- Hook exports that were needed by old architecture but no longer consumed
- Functions defined but never called
- Parameters in interfaces that no caller passes
- Empty type definition files (e.g., `export {}`)

## Tips

- Start with obvious cases (empty files, unused imports)
- Be conservative with exported functions - they might be used by external consumers
- Always verify with TypeScript compilation after cleanup
