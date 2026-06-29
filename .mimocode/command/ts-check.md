---
description: Run TypeScript type checking and build verification for the project
---

# TypeScript Compilation Check

Run TypeScript type checking and build verification for the Ink terminal project.

## Steps

1. Run type checking:
   ```bash
   npx tsc --noEmit 2>&1
   ```

2. If type checking passes, run build:
   ```bash
   npm run build
   ```

3. Report results:
   - If both pass: "TypeScript compilation successful"
   - If type checking fails: Report the errors with file paths and line numbers
   - If build fails: Report the build error

## Notes

- This project uses TypeScript with strict mode
- Common issues: missing imports, type mismatches, unused variables
- The project structure has frontend (src/frontend/) and agent (src/agent/) directories
