
# Testing Guide

> [!NOTE]
> **Goal**: In this short tutorial, you will learn how to verify your code changes using the automated test suite.

## 1. The Test Runner

We use **Vitest** for unit testing. It is a blazing fast test runner native to Vite.

## 2. Running Tests

To run the tests, simply execute:

```bash
npm test
```

This command will:
1.  Look for files named `*.test.ts` or `*.spec.ts`.
2.  Run them in a simulated environment.
3.  Report which tests passed or failed.

## 3. What Should I Test?

If you are adding new logic to the `scripts/` folder (like `sync-content.ts`), you should verify it handles edge cases (e.g., missing files).

If you are adding a new Vue component, you might write a component test (though currently, our tests focus mostly on logic).

---

> [!TIP]
> **Output**: When you run `npm test`, you should see a green checkmark indicating all tests passed.
>
> ```
>  ✓ scripts/some-script.test.ts (2 tests)
>  Test Files  1 passed (1)
>       Tests  2 passed (2)
> ```
