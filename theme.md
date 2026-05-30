# TelcoVantage ERP — Design System

## Colors

| Token             | Value     | Usage                         |
|-------------------|-----------|-------------------------------|
| `--color-primary` | `#0a5c3b` | Primary brand (TelcoVantage green) |
| `--color-primary-light` | `#0c6a43` | Hover/active states     |

### Light Mode
| Token               | Value     | Usage                         |
|---------------------|-----------|-------------------------------|
| `--background`      | `#f8fafc` | Page background               |
| `--foreground`      | `#0f172a` | Text color                    |
| `.glass-card` bg    | `rgba(255, 255, 255, 0.45)` | Card backdrop   |
| `.glass-card` border| `rgba(10, 92, 59, 0.12)` | Card border       |
| `.glass-card` shadow| `rgba(10, 92, 59, 0.08)` | Card shadow       |

### Dark Mode
| Token               | Value     | Usage                         |
|---------------------|-----------|-------------------------------|
| `--background`      | `#202124` | Page background               |
| `--foreground`      | `#ededed` | Text color                    |
| `.dark .glass-card` bg | `rgba(15, 23, 42, 0.4)` | Card backdrop   |
| `.dark .glass-card` border | `rgba(255, 255, 255, 0.08)` | Card border |
| `.dark .glass-card` shadow | `rgba(12, 106, 67, 0.15)` inset |  Card glow |

## Typography

- **Font (Headings/UI)**: `Plus Jakarta Sans` (`--font-plus-jakarta`)
- **Font (Body)**: `Inter` (`--font-inter`)
- Applied via CSS variable: `font-sans` → `var(--font-plus-jakarta)`, `font-body` → `var(--font-inter)`

## Components

### Glass Card (`.glass-card`)
```
background: rgba(255, 255, 255, 0.45);
backdrop-filter: blur(32px) saturate(1.5);
border: 1px solid rgba(10, 92, 59, 0.12);
box-shadow:
  0 0 0 1px rgba(10, 92, 59, 0.05) inset,
  0 8px 32px rgba(10, 92, 59, 0.08),
  0 2px 8px rgba(0, 0, 0, 0.04);
```
Dark variant wraps in `.dark` class with darker backdrop, subtle green inner glow.

### Noise Overlay (`.noise-overlay`)
Fractal noise SVG at 3% opacity, 256×256 repeating tile. Applied as `background-image`.

### Blob Animation (`.animate-blob`)
7s infinite ease-in-out floating animation with scale wobble:
- 0%: translate(0, 0) scale(1)
- 33%: translate(30px, -50px) scale(1.1)
- 66%: translate(-20px, 20px) scale(0.9)
- 100%: translate(0, 0) scale(1)

Delayed variants: `.animation-delay-2000` (2s), `.animation-delay-4000` (4s).

## Theme Toggle

Powered by `next-themes` with `attribute="class"`, `defaultTheme="dark"`, `enableSystem`.
