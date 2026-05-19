# Agent Notes

- `packages/web` Vitest tests run in a real browser when invoked with the browser project, for example:
  `pnpm exec vitest --run <test-file> --project browser --browser chromium`.
- For browser-project tests, prefer real DOM layout, CSS sizing, and browser APIs over jsdom-style geometry mocks. In
  particular, avoid overriding `getBoundingClientRect()` when the behavior under test depends on viewport intersection,
  visibility, or element size.
