---
applyTo: "scripts/**/*.{js,mjs,cjs}"
---

## Integration Script Guidelines

When writing integration scripts for aiken-devtools-mcp, follow these patterns:

1. **Use ESM or CommonJS consistently** - Choose `.mjs` for ESM, `.cjs` for CommonJS, or `.js` with package.json type
1. **Add descriptive headers** - Include a comment at the top explaining what the script does
1. **Handle errors gracefully** - Use try-catch blocks and provide meaningful error messages
1. **Support command-line arguments** - Use `process.argv` for simple cases or a library for complex CLI needs
1. **Validate inputs** - Check required inputs and provide helpful usage messages
1. **Use async/await** - Prefer async/await over callbacks or raw promises
1. **Exit with appropriate codes** - Use `process.exit(0)` for success, non-zero for failures
1. **Log meaningful output** - Use `console.log()` for normal output, `console.error()` for errors
1. **Import from built code** - When testing MCP tools, import from `dist/` after building
1. **Document usage** - Add a comment or help message showing how to run the script

### Example Script Structure

```javascript
#!/usr/bin/env node

/**
 * Script to test aiken MCP tool functionality
 * Usage: node scripts/test-tool.mjs [options]
 */

import { someFunction } from '../dist/index.cjs';

async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--help')) {
      console.log('Usage: node scripts/test-tool.mjs [--option value]');
      process.exit(0);
    }
    
    const result = await someFunction();
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
```
