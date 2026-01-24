# Theme Architecture

This document describes the unified theme system for the GLAPI web application. The architecture ensures consistent styling across all components while supporting light/dark mode and responsive layouts.

## Overview

The theme system follows a three-layer architecture:

```
CSS Variables (globals.css)    <-- Source of truth
         |
         v
Tailwind Theme (@theme inline) <-- Bridges CSS vars to utilities
         |
         v
ShadCN Components             <-- Use Tailwind utility classes
```

**Key Principle**: CSS variables defined in `globals.css` are the single source of truth. All theming flows from these variables.

---

## 1. CSS Variables as Source of Truth

Located in: `apps/web/src/app/globals.css`

### Core Design Token Categories

| Category | Variables | Purpose |
|----------|-----------|---------|
| **Semantic Colors** | `--background`, `--foreground` | Base page colors |
| **Component Colors** | `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive` | UI component backgrounds |
| **Foreground Pairs** | `--*-foreground` | Text colors paired with backgrounds |
| **Borders & Inputs** | `--border`, `--input`, `--ring` | Form and focus states |
| **Charts** | `--chart-1` through `--chart-5` | Data visualization |
| **Sidebar** | `--sidebar`, `--sidebar-*` | Navigation sidebar theming |
| **Radius** | `--radius` | Border radius base value |

### Color Format: OKLCH

All colors use the **OKLCH** color space for perceptual uniformity:

```css
--primary: oklch(0.205 0 0);        /* Lightness Chroma Hue */
--destructive: oklch(0.577 0.245 27.325);
```

**Benefits of OKLCH:**
- Perceptually uniform lightness adjustments
- Better color interpolation for transitions
- Consistent contrast ratios across the palette

### Light Mode (`:root`)

```css
:root {
  --radius: 0.625rem;

  /* Background colors */
  --background: oklch(1 0 0);           /* Pure white */
  --foreground: oklch(0.145 0 0);       /* Near black */

  /* Component surfaces */
  --card: oklch(1 0 0);
  --popover: oklch(1 0 0);
  --primary: oklch(0.205 0 0);          /* Dark gray */
  --secondary: oklch(0.97 0 0);         /* Light gray */
  --muted: oklch(0.97 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);  /* Red */

  /* Borders and inputs */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

### Dark Mode (`.dark`)

```css
.dark {
  --background: oklch(0.145 0 0);       /* Near black */
  --foreground: oklch(0.985 0 0);       /* Near white */

  /* Component surfaces */
  --card: oklch(0.205 0 0);
  --popover: oklch(0.205 0 0);
  --primary: oklch(0.922 0 0);          /* Light gray */
  --secondary: oklch(0.269 0 0);
  --muted: oklch(0.269 0 0);
  --accent: oklch(0.269 0 0);
  --destructive: oklch(0.704 0.191 22.216);

  /* Borders with transparency for dark mode */
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);

  /* Sidebar */
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);  /* Blue accent */
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

---

## 2. Tailwind Theme Configuration

Located in: `apps/web/src/app/globals.css` (within `@theme inline` block)

### Bridging CSS Variables to Tailwind

The `@theme inline` block maps CSS variables to Tailwind's color system:

```css
@theme inline {
  /* Core colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Component colors */
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);

  /* Borders and inputs */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Sidebar */
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* Charts */
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* Radius scale */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Fonts */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### Using in Tailwind Classes

After bridging, use semantic Tailwind classes:

```tsx
// Background and text
<div className="bg-background text-foreground">

// Cards
<div className="bg-card text-card-foreground">

// Primary buttons
<button className="bg-primary text-primary-foreground">

// Muted/secondary content
<p className="text-muted-foreground">

// Borders
<div className="border border-border">

// Focus states
<input className="focus:ring-ring">

// Sidebar
<aside className="bg-sidebar text-sidebar-foreground">
```

---

## 3. ShadCN Component Token Alignment

ShadCN components use the semantic Tailwind classes directly, ensuring automatic theme support.

### Example: Button Component

```tsx
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
  }
)
```

### Example: Card Component

```tsx
<div className="bg-card text-card-foreground rounded-xl border shadow-sm">
  <p className="text-muted-foreground">Description text</p>
</div>
```

### Token Usage Guidelines

| Element | Correct Token | Avoid |
|---------|---------------|-------|
| Page background | `bg-background` | `bg-white`, `bg-gray-900` |
| Text on page | `text-foreground` | `text-black`, `text-gray-100` |
| Card surface | `bg-card` | `bg-white`, `bg-gray-800` |
| Secondary text | `text-muted-foreground` | `text-gray-500`, `text-gray-400` |
| Borders | `border-border` | `border-gray-200`, `border-gray-700` |
| Hover states | `hover:bg-accent` | `hover:bg-gray-100` |

---

## 4. Dark Mode Implementation

### Using next-themes

Dark mode is managed via `next-themes` with the `class` strategy:

```ts
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ...
}
```

```tsx
// ThemeProvider setup (typically in layout.tsx or providers.tsx)
import { ThemeProvider } from 'next-themes'

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

### Custom Variant

The custom dark variant in globals.css:

```css
@custom-variant dark (&:is(.dark *));
```

This enables `dark:` prefixed utilities when the `.dark` class is on an ancestor.

### Best Practices

1. **Prefer semantic tokens over manual dark: overrides**
   ```tsx
   // Good - automatic theme switching
   <div className="bg-card text-card-foreground">

   // Avoid - requires manual dark mode handling
   <div className="bg-white dark:bg-gray-800 text-black dark:text-white">
   ```

2. **Use transparency for overlays in dark mode**
   ```css
   --border: oklch(1 0 0 / 10%);  /* White with 10% opacity */
   ```

3. **Test both modes** during development using the theme toggle.

---

## 5. Mobile Responsive Strategy

### Breakpoint System

Tailwind's default breakpoints (mobile-first):

| Breakpoint | Min Width | Target |
|------------|-----------|--------|
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops, small desktops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

### Mobile-First Approach

Design for mobile first, then enhance for larger screens:

```tsx
// Mobile: full width, Desktop: 50% width
<div className="w-full md:w-1/2">

// Mobile: stacked, Desktop: side-by-side
<div className="flex flex-col lg:flex-row">

// Mobile: smaller text, Desktop: larger
<h1 className="text-2xl md:text-4xl lg:text-5xl">
```

### Sidebar Responsive Patterns

The sidebar uses two primary responsive patterns:

#### Pattern 1: Collapsible Sidebar (Desktop)

Desktop users can collapse the sidebar to save space:

```tsx
// Width transitions based on collapsed state
<aside className={cn(
  'transition-all duration-300 ease-in-out',
  collapsed ? 'w-16' : 'w-72'
)}>
```

#### Pattern 2: Slide-out Drawer (Mobile)

On mobile, the sidebar transforms into a slide-out drawer:

```tsx
// Mobile: Hidden by default, slides in from left
// Use Sheet component from ShadCN for this pattern
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <MenuIcon className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-72 p-0">
    <SidebarContent />
  </SheetContent>
</Sheet>
```

### Responsive Layout Structure

```tsx
// Main layout with responsive sidebar
<div className="flex min-h-screen">
  {/* Desktop sidebar - hidden on mobile */}
  <div className="hidden md:block">
    <Sidebar />
  </div>

  {/* Mobile header with hamburger menu */}
  <header className="md:hidden fixed top-0 left-0 right-0 z-50">
    <MobileHeader />
  </header>

  {/* Main content */}
  <main className="flex-1 pt-14 md:pt-0">
    {children}
  </main>
</div>
```

---

## 6. Sidebar CSS Variables

### Current Sidebar Variables

These variables are defined and ready to use:

```css
:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

### Tailwind Classes for Sidebar

Use these semantic classes in sidebar components:

```tsx
// Sidebar container
<aside className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">

// Active nav item
<Link className="bg-sidebar-primary text-sidebar-primary-foreground">

// Hover state on nav item
<Link className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">

// Focus ring
<button className="focus:ring-sidebar-ring">
```

### ISSUE: Current Hardcoded Colors in NewPageSidebar.tsx

The current `NewPageSidebar.tsx` uses hardcoded Tailwind gray colors instead of semantic tokens:

**Current (Incorrect):**
```tsx
<aside className="bg-gray-900 text-gray-100">
<div className="border-b border-gray-700">
const activeLinkClass = 'bg-gray-700 text-white';
const inactiveLinkClass = 'hover:bg-gray-700/50 hover:text-white';
```

**Should Be:**
```tsx
<aside className="bg-sidebar text-sidebar-foreground">
<div className="border-b border-sidebar-border">
const activeLinkClass = 'bg-sidebar-primary text-sidebar-primary-foreground';
const inactiveLinkClass = 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground';
```

---

## 7. Missing CSS Variables (Gaps to Address)

The following CSS variables should be added to support additional sidebar states and components:

### Recommended Additions to globals.css

```css
:root {
  /* Existing variables... */

  /* Sidebar muted (for secondary text in sidebar) */
  --sidebar-muted: oklch(0.97 0 0);
  --sidebar-muted-foreground: oklch(0.556 0 0);

  /* Sidebar hover states with better granularity */
  --sidebar-hover: oklch(0.95 0 0);

  /* Sidebar section headers */
  --sidebar-section-header: oklch(0.556 0 0);
}

.dark {
  /* Existing variables... */

  /* Sidebar muted (for secondary text in sidebar) */
  --sidebar-muted: oklch(0.269 0 0);
  --sidebar-muted-foreground: oklch(0.556 0 0);

  /* Sidebar hover states with better granularity */
  --sidebar-hover: oklch(0.25 0 0);

  /* Sidebar section headers */
  --sidebar-section-header: oklch(0.5 0 0);
}
```

### Add to @theme inline Block

```css
@theme inline {
  /* Existing mappings... */

  --color-sidebar-muted: var(--sidebar-muted);
  --color-sidebar-muted-foreground: var(--sidebar-muted-foreground);
  --color-sidebar-hover: var(--sidebar-hover);
  --color-sidebar-section-header: var(--sidebar-section-header);
}
```

---

## 8. Code Examples

### Correct: Using Theme Tokens

```tsx
// Card with proper theming
<Card className="bg-card text-card-foreground">
  <CardHeader>
    <CardTitle>Dashboard</CardTitle>
    <CardDescription className="text-muted-foreground">
      Overview of your account
    </CardDescription>
  </CardHeader>
</Card>

// Button with semantic colors
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Submit
</Button>

// Sidebar navigation item
<Link
  className={cn(
    "flex items-center px-3 py-2 rounded-md",
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground"
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  )}
>
  <HomeIcon className="h-5 w-5 mr-3" />
  Dashboard
</Link>
```

### Incorrect: Hardcoded Colors

```tsx
// AVOID - these break theme switching
<div className="bg-white text-black dark:bg-gray-800 dark:text-white">
<aside className="bg-gray-900 text-gray-100">
<Link className="bg-gray-700 text-white hover:bg-gray-600">
```

---

## 9. Implementation Checklist

When implementing themed components:

- [ ] Use semantic Tailwind classes (`bg-primary`, `text-foreground`) not gray/color values
- [ ] Ensure foreground pairs are used together (`bg-card text-card-foreground`)
- [ ] Test in both light and dark modes
- [ ] Check responsive behavior at all breakpoints
- [ ] For sidebar, use `sidebar-*` tokens
- [ ] Verify focus states use `ring-ring` or appropriate focus tokens

---

## References

- [ShadCN UI Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [next-themes](https://github.com/pacocoursey/next-themes)
- [OKLCH Color Space](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)
