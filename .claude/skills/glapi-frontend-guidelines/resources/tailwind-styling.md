# Tailwind CSS Styling

Complete guide to styling Sureshake components with Tailwind CSS.

---

## Core Philosophy

**Utility-First:**
- Apply styles directly with utility classes
- No custom CSS unless absolutely necessary
- Compose utilities for complex designs
- Responsive and dark mode built-in

---

## Common Patterns

### Layout

```typescript
// Flexbox
<div className="flex flex-col gap-4">              // Vertical stack
<div className="flex items-center justify-between"> // Horizontal with space-between
<div className="flex flex-wrap gap-2">             // Wrapping flex

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<div className="grid grid-cols-[200px_1fr] gap-4"> // Fixed + flexible columns
```

### Spacing

```typescript
// Padding (1 unit = 0.25rem = 4px)
className="p-4"      // 1rem all sides
className="px-6"     // 1.5rem horizontal
className="py-2"     // 0.5rem vertical
className="pt-8"     // 2rem top only

// Margin
className="m-4 mx-auto"  // Center with auto horizontal margin

// Gap (for flex/grid)
className="gap-2 gap-x-4 gap-y-2"
```

### Colors (Theme-Aware)

```typescript
// Background
className="bg-background"    // Adapts to theme
className="bg-primary"       // Primary color
className="bg-card"          // Card background
className="bg-destructive"   // Destructive/error color

// Text
className="text-foreground"        // Primary text
className="text-muted-foreground"  // Secondary text
className="text-primary"           // Primary colored text

// Border
className="border border-border"   // Default border
className="border-2 border-primary" // Thicker primary border

// Opacity
className="bg-primary/90"     // 90% opacity
className="text-foreground/70" // 70% opacity
```

### Typography

```typescript
// Size
className="text-sm text-base text-lg text-xl text-2xl text-3xl"

// Weight
className="font-normal font-medium font-semibold font-bold"

// Style
className="italic not-italic"
className="uppercase lowercase capitalize"
className="underline line-through"

// Line Height
className="leading-tight leading-normal leading-relaxed"

// Truncation
className="truncate"              // Single line ellipsis
className="line-clamp-2"          // Multi-line ellipsis
```

### Sizing

```typescript
// Width
className="w-full w-1/2 w-64 w-auto"
className="min-w-0 min-w-full max-w-sm max-w-md max-w-lg"

// Height
className="h-full h-screen h-64 h-auto"
className="min-h-screen max-h-96"
```

### Border & Rounding

```typescript
// Border
className="border border-2 border-t border-b-4"
className="border-solid border-dashed border-none"

// Border Radius
className="rounded rounded-lg rounded-full"
className="rounded-t-lg rounded-br-xl"
```

### Shadows

```typescript
className="shadow shadow-md shadow-lg shadow-xl"
className="shadow-none"
```

---

## Responsive Design

Use breakpoint prefixes:

```typescript
// Mobile first approach
className="text-sm md:text-base lg:text-lg"        // Text size grows
className="flex-col md:flex-row"                    // Stack on mobile, row on desktop
className="hidden md:block"                         // Hidden on mobile, visible on desktop
className="w-full md:w-1/2 lg:w-1/3"                // Full width on mobile, shrinks on larger screens

// Breakpoints:
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px
```

---

## Dark Mode (Automatic)

Sureshake uses CSS variables that automatically adapt:

```typescript
// These adapt automatically - no dark: prefix needed!
className="bg-background text-foreground"       // White bg in light, dark in dark mode
className="bg-card text-card-foreground"        // Card colors adapt
className="border-border"                       // Border adapts

// Manual dark mode (rarely needed)
className="bg-white dark:bg-slate-900"
className="text-gray-900 dark:text-gray-100"
```

---

## Conditional Styling with cn()

```typescript
import { cn } from '@sureshake/ui';

// Simple condition
<div className={cn(
  "base-class",
  isActive && "active-class"
)} />

// Multiple conditions
<Button className={cn(
  "flex items-center gap-2",
  isLoading && "opacity-50 cursor-not-allowed",
  variant === "primary" && "bg-primary text-primary-foreground",
  className  // Allow external override
)} />

// With objects
<div className={cn(
  "p-4 rounded-lg",
  {
    "bg-green-100": status === "success",
    "bg-red-100": status === "error",
    "bg-gray-100": status === "pending",
  },
  className
)} />
```

---

## Component Variants with cva

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@sureshake/ui";

const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  className?: string;
}

function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// Usage
<Button variant="destructive" size="lg">Delete</Button>
```

---

## Animations & Transitions

```typescript
// Transitions
className="transition-all duration-200"
className="transition-colors hover:bg-primary/90"

// Transforms
className="hover:scale-105 active:scale-95"
className="hover:translate-y-1"
className="rotate-45"

// Animations (defined in tailwind.config.js)
className="animate-spin"      // Loading spinner
className="animate-pulse"     // Pulsing effect
className="animate-bounce"    // Bouncing
```

---

## Common Component Styles

### Card

```typescript
<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
```

### Button

```typescript
<button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
```

### Input

```typescript
<input className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
```

### Badge

```typescript
<span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
```

### Cards on Dark Backgrounds (Theme-Aware)

**❌ WRONG - Hardcoded dark colors:**
```typescript
// This only works on dark backgrounds and breaks theme switching
<Card className="bg-white/5 border-white/10">
  <CardContent>
    <h3 className="text-white">Title</h3>
    <p className="opacity-90">Text</p>
  </CardContent>
</Card>
```

**✅ CORRECT - Theme-aware CSS variables:**
```typescript
// Adapts to both light and dark themes
<Card className="bg-card/50 border-border backdrop-blur">
  <CardContent>
    <h3 className="text-foreground">Title</h3>
    <p className="text-muted-foreground">Text</p>
  </CardContent>
</Card>
```

**Pattern Explanation:**
- `bg-card/50` - Semi-transparent card background that adapts to theme
- `border-border` - Border uses theme's border color
- `backdrop-blur` - Adds blur effect for glass morphism
- `text-foreground` - Primary text adapts to theme
- `text-muted-foreground` - Secondary text adapts to theme
- `text-primary` - Accent color adapts to theme

**More Examples:**
```typescript
// Glass card on any background
<Card className="bg-card/30 border-border backdrop-blur-md">

// Elevated card with theme-aware shadow
<Card className="bg-card border-border shadow-lg">

// Subtle card variant
<Card className="bg-muted/50 border-muted">
```

---

## Best Practices

1. **Use CSS variables** - `bg-primary` not `bg-blue-500`
2. **Mobile-first** - Start with mobile, add md:/lg: prefixes
3. **Use cn()** - For conditional classes
4. **Never hardcode dark/light colors** - Use theme variables like `bg-card`, `text-foreground`
4. **Leverage cva** - For component variants
5. **Avoid !important** - Use proper specificity
6. **Keep classes readable** - Line breaks for long class lists
7. **Use semantic colors** - `bg-destructive` not `bg-red-600`
8. **Let dark mode adapt** - Use CSS variables, not dark: prefix
