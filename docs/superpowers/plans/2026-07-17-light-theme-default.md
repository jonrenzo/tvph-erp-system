# Light Theme Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make light mode the default for users without a saved theme while retaining saved theme preferences.

**Architecture:** The root layout configures the existing `next-themes` provider. Change only its fallback theme; `next-themes` continues to read existing local storage preferences before using that fallback.

**Tech Stack:** Next.js 16, React 19, TypeScript, next-themes, Jest.

## Global Constraints

- Do not add dependencies or user-interface controls.
- Preserve the existing `light`, `dark`, and `midnight` theme choices and system-theme option.
- Do not stage `project-management-module-plan.md`.

---

### Task 1: Change the root theme fallback

**Files:**
- Modify: `app/layout.tsx:41-47`
- Test: `__tests__/layout-toaster.test.tsx`

**Interfaces:**
- Consumes: the existing `ThemeProvider` props in `app/layout.tsx`.
- Produces: `ThemeProvider` receives `defaultTheme="light"`.

- [x] **Step 1: Write the failing test**

Replace the theme-provider mock and add a root-layout assertion:

```tsx
jest.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children, defaultTheme }: any) => (
    <div data-testid="theme-provider" data-default-theme={defaultTheme}>{children}</div>
  ),
}));

it('defaults the root theme provider to light', () => {
  render(<RootLayout><div>Test Content</div></RootLayout>);
  expect(screen.getByTestId('theme-provider')).toHaveAttribute('data-default-theme', 'light');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/layout-toaster.test.tsx`

Expected: FAIL because the layout currently passes `defaultTheme="dark"`.

- [x] **Step 3: Write minimal implementation**

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="light"
  enableSystem
  disableTransitionOnChange
  themes={["light", "dark", "midnight"]}
>
```

- [x] **Step 4: Run test and production build**

Run: `npm test -- --runInBand __tests__/layout-toaster.test.tsx` and `npm run build`

Expected: both commands exit 0.

- [x] **Step 5: Commit and push**

```powershell
git add app/layout.tsx __tests__/layout-toaster.test.tsx docs/superpowers/plans/2026-07-17-light-theme-default.md
git commit -m "fix: default to light theme"
git push -u origin agent/light-theme-default
```
