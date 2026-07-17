# Light Theme Default

## Goal

New visitors start in light mode while existing users retain their saved theme.

## Change

Set the root `ThemeProvider` default theme from `dark` to `light` in `app/layout.tsx`.

## Behavior

- A user without a stored theme starts in light mode.
- A stored `light`, `dark`, or `midnight` preference continues to take precedence.
- The existing appearance settings and system-theme option remain available.

## Verification

Run the layout-focused test and production build after the change.
