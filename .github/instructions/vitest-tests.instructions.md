---
applyTo: "**/*.test.ts"
---

## Vitest Test Guidelines

When writing tests for aiken-devtools-mcp, follow these patterns:

1. **Use Vitest** - This project uses Vitest as the test framework
1. **Test file naming** - Use `*.test.ts` suffix for test files
1. **Organize tests** - Group related tests using `describe()` blocks
1. **Write descriptive test names** - Use clear, specific test descriptions with `test()` or `it()`
1. **Use type-safe assertions** - Leverage TypeScript types with Vitest's `expect()` API
1. **Mock external dependencies** - Use Vitest's mocking capabilities for external calls
1. **Test both success and error cases** - Cover happy paths and error scenarios
1. **Keep tests isolated** - Each test should be independent and not rely on other tests' state
1. **Use beforeEach/afterEach** - Set up and clean up test state properly
1. **Add coverage** - Aim for good test coverage, run `npm test` to check coverage

### Example Test Structure

```typescript
import { describe, test, expect, beforeEach } from 'vitest';

describe('aiken_example_tool', () => {
  beforeEach(() => {
    // Setup test state
  });

  test('should return success on valid input', async () => {
    const result = await exampleFunction({ projectDir: '.' });
    expect(result.success).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    const result = await exampleFunction({ projectDir: '/invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```
