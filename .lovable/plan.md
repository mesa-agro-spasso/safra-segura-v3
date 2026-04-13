

# Add Logo to Sidebar & Update Color Theme to #123332

## Overview
Copy the uploaded Safra Segura logo into the project, display it in the sidebar header, and update the app's color palette to use the dark cyan (#123332 ≈ HSL 178 48% 14%) as the new accent/primary tone.

## Changes

### 1. Copy logo to project
Copy `user-uploads://Monetização_do_Armazém_Confresa_Estratégia_de_Carrego_para_Captura.png` → `src/assets/safra-segura-logo.png`

### 2. Update `src/components/AppSidebar.tsx`
- Import the logo: `import logo from '@/assets/safra-segura-logo.png'`
- Replace the `SidebarGroupLabel` text "SAFRA SEGURA" with the logo image
- When collapsed, show a small version; when expanded, show full logo (~140px wide)
- Add some padding/margin for breathing room

### 3. Update `src/index.css` — color theme
Replace the current green-based primary (#22c55e / HSL 142 70% 45%) with a palette derived from #123332:

| Variable | Current | New (dark cyan family) |
|---|---|---|
| `--primary` | 142 70% 45% | 178 48% 35% (lighter cyan for buttons/accents) |
| `--primary-foreground` | 222 47% 6% | 178 48% 95% (light text on primary) |
| `--ring` | 142 70% 45% | 178 48% 35% |
| `--sidebar-background` | 222 47% 5% | 178 48% 7% (very dark cyan) |
| `--sidebar-primary` | 142 70% 45% | 178 48% 35% |
| `--sidebar-primary-foreground` | 222 47% 6% | 178 48% 95% |
| `--sidebar-ring` | 142 70% 45% | 178 48% 35% |
| `--sidebar-accent` | 215 25% 12% | 178 30% 14% |
| `--sidebar-border` | 215 25% 14% | 178 25% 16% |
| `--background` | 222 47% 6% | 178 40% 6% |
| `--card` | 222 44% 9% | 178 38% 9% |
| `--popover` | 222 44% 9% | 178 38% 9% |
| `--border` | 215 25% 16% | 178 25% 16% |
| `--input` | 215 25% 18% | 178 25% 18% |
| `--secondary` | 215 25% 16% | 178 25% 16% |
| `--muted` | 215 25% 14% | 178 25% 14% |
| `--accent` | 215 25% 16% | 178 25% 16% |

The overall look shifts from blue-slate + green to a cohesive dark teal/cyan family matching the logo background.

### What does NOT change
- Layout structure, routing, functionality
- All page logic (Orders, Pricing, MTM, Market, etc.)
- Auth flow, admin panel

