---
name: adteco-frontend-guidelines
description: Frontend development guidelines for Adteco's React 18/19 + ShadCN/Radix UI + Tailwind stack. Patterns for building accessible, performant components with type safety, TanStack Query data fetching, and modern styling.
---

# Adteco Frontend Development Guidelines

## Purpose

Comprehensive guide for building frontend components in Adteco using:
- **React 18/19** - Modern React features
- **ShadCN + Radix UI** - Unstyled, accessible component primitives
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Powerful data fetching and caching
- **Next.js 15** - App router, server components
- **TypeScript** - Full type safety
- **Clerk** - Authentication

## When to Use This Skill

- Creating new components or pages
- Building with ShadCN/Radix UI components
- Styling with Tailwind CSS utilities
- Fetching data with TanStack Query
- Implementing forms with React Hook Form
- Organizing frontend code structure
- Optimizing performance
- Managing dark mode with next-themes
- Working with Clerk authentication

---

## Quick Start

### New Component Checklist

Creating a component? Follow this checklist:

- [ ] Import ShadCN components from `@/components/ui`
- [ ] Use Tailwind utility classes for styling
- [ ] Use `cn()` utility for conditional/merged classes (from `@/lib/utils`)
- [ ] Import icons from `lucide-react` or `@heroicons/react`
- [ ] Use `cva` for component variants if needed
- [ ] Type component props with TypeScript interface
- [ ] Fetch data with TanStack Query (`useQuery`, `useMutation`)
- [ ] Handle dark mode with CSS variables
- [ ] Ensure accessibility (Radix handles most)
- [ ] No inline styles - use Tailwind classes
- [ ] Default export at bottom

### New Feature Checklist

Creating a feature? Set up this structure:

- [ ] Create feature directory in `apps/web/src/`
- [ ] Create subdirectories: `components/`, `hooks/`, `types/`
- [ ] Use TanStack Query for API calls
- [ ] Create TypeScript types in `types/`
- [ ] Export public API from feature `index.ts`
- [ ] Use ShadCN components from `@/components/ui`
- [ ] Apply Tailwind styling consistently

---

## Import Patterns Quick Reference

### UI Components (ShadCN)

```typescript
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';  // Class utility
```

### Icons

```typescript
import { Plus, Trash2, Settings, Check } from 'lucide-react';
// OR
import { PlusIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
```

### TanStack Query (Data Fetching)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// In component
const { data, isLoading, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetch(`/api/users/${userId}`).then(res => res.json()),
});

const mutation = useMutation({
  mutationFn: (data) => fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});
```

### Forms

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
```

### Dark Mode

```typescript
import { useTheme } from 'next-themes';
```

### Clerk Authentication

```typescript
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs';

const { user, isLoaded, isSignedIn } = useUser();
const { getToken, signOut } = useAuth();
```

---

## Common Imports Cheatsheet

```typescript
// React
import React, { useState, useCallback, useMemo } from 'react';

// UI Components (ShadCN)
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Icons
import { Plus, Edit, Trash2 } from 'lucide-react';

// TanStack Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Forms
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Dark Mode
import { useTheme } from 'next-themes';

// Clerk Auth
import { useUser, useAuth } from '@clerk/nextjs';

// Types
import type { User } from '@/types';
```

---

## Topic Guides

### 🎨 Component Patterns

**Modern Adteco components use:**
- ShadCN/Radix UI components from `@/components/ui`
- Tailwind utility classes for styling
- `cn()` for conditional class merging (from `@/lib/utils`)
- `cva` for variant-based styling
- TypeScript for props and types

**Key Concepts:**
- ShadCN provides pre-styled Radix primitives in your codebase
- Components live in `apps/web/src/components/ui/`
- Accessibility built into Radix components
- Composition over configuration
- CSS variables for theme-aware colors

**[📖 Complete Guide: resources/component-patterns.md](resources/component-patterns.md)**

---

### 🎨 Styling with Tailwind

**PRIMARY APPROACH: Utility Classes**
- Use Tailwind utilities directly in className
- Use `cn()` for conditional/merged classes
- Use CSS variables for theme colors
- Responsive with `sm:`, `md:`, `lg:` prefixes
- Dark mode with CSS variables (automatic)

**Component Variants:**
- Use `class-variance-authority` (cva) for variants
- Export `buttonVariants`, `cardVariants`, etc.
- Type-safe with `VariantProps`

**[📖 Complete Guide: resources/tailwind-styling.md](resources/tailwind-styling.md)**

---

### 🧩 ShadCN/Radix UI Integration

**ShadCN Philosophy:**
- **Copy, not install** - Components live in your codebase
- **Built on Radix UI** - Accessible primitives
- **Tailwind styling** - Utility-first approach
- **Customizable** - Modify components as needed

**Radix UI Philosophy:**
- **Unstyled primitives** - No default styles (ShadCN adds styling)
- **Accessibility-first** - ARIA, keyboard nav built-in
- **Composition-based** - Combine primitives
- **Headless** - Full styling control

**Available Components:**
- Dialog, AlertDialog, DropdownMenu
- Select, Checkbox, Switch, Tabs
- Popover, Toast, Avatar, Progress
- Form (with React Hook Form integration)

**[📖 Complete Guide: resources/radix-ui-integration.md](resources/radix-ui-integration.md)**

---

### 📊 Data Fetching with TanStack Query

**PRIMARY PATTERN: TanStack Query**
- Powerful caching and state management
- Automatic background refetching
- Optimistic updates support
- Loading and error states
- DevTools for debugging

**Query Pattern:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['users', userId],
  queryFn: async () => {
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Mutation Pattern:**
```typescript
const queryClient = useQueryClient();

const updateUser = useMutation({
  mutationFn: async (data) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update');
    return res.json();
  },
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['users', userId] });
  },
});
```

**[📖 Complete Guide: resources/data-fetching.md](resources/data-fetching.md)**

---

### 📁 File Organization

**Typical Structure:**
```
apps/web/src/
  app/                  # Next.js app router pages
  components/
    ui/                 # ShadCN components
    shared/             # Shared components
  lib/
    utils.ts            # cn() utility and helpers
  hooks/                # Custom React hooks
  types/                # TypeScript types
```

**Component Files:**
- One component per file
- Co-locate small sub-components
- Use `.tsx` extension
- Default export at bottom

**[📖 Complete Guide: resources/file-organization.md](resources/file-organization.md)**

---

### 🌓 Dark Mode

**Adteco uses next-themes:**
- Class-based strategy (`class="dark"`)
- CSS variables for colors
- System preference detection
- Persistent across sessions

**Pattern:**
```typescript
import { useTheme } from 'next-themes';

const { theme, setTheme } = useTheme();

<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  Toggle Theme
</button>
```

**Styling:**
```typescript
<div className="bg-background text-foreground">
  Content adapts to theme automatically
</div>
```

---

### 🔐 Authentication with Clerk

**Clerk Patterns:**
- Use `useUser()` for current user data
- Use `useAuth()` for auth state and tokens
- Use Clerk UI components for sign-in/sign-up
- Protected routes with middleware

**Example:**
```typescript
import { useUser } from '@clerk/nextjs';

export function MyComponent() {
  const { user, isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Not signed in</div>;

  return <div>Hello {user.firstName}!</div>;
}
```

---

### ⚡ Performance

**Optimization Patterns:**
- `useMemo`: Expensive computations
- `useCallback`: Event handlers passed to children
- `React.memo`: Expensive components
- Debounced search (300-500ms)
- Code splitting with dynamic imports
- Image optimization with `next/image`
- TanStack Query caching and staleTime

**[📖 Complete Guide: resources/performance.md](resources/performance.md)**

---

### 📘 TypeScript

**Standards:**
- Strict mode enabled
- Explicit prop interfaces
- Type imports: `import type { User } from '@/types'`
- No `any` type
- Use Zod for runtime validation

**[📖 Complete Guide: resources/typescript-standards.md](resources/typescript-standards.md)**

---

## Core Principles

1. **Use ShadCN Components**: Import from `@/components/ui` directory
2. **Tailwind for Styling**: Use utility classes, not inline styles or CSS-in-JS
3. **cn() for Conditional Classes**: Always use `cn()` from `@/lib/utils`
4. **TanStack Query for Data**: Powerful caching and state management
5. **Radix for Accessibility**: Built into ShadCN components
6. **CSS Variables for Theme**: Use `bg-primary`, `text-foreground`, etc.
7. **TypeScript Everywhere**: Full type safety for props, state, API calls
8. **Accessibility Built-in**: Radix handles most ARIA patterns
9. **next-themes for Dark Mode**: Use CSS variables, not manual toggles
10. **cva for Variants**: Use class-variance-authority for component variants

---

## Quick Reference: Component Template

```typescript
'use client'; // If using client-side features

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface MyComponentProps {
  userId: string;
  onSuccess?: () => void;
  className?: string;
}

export function MyComponent({
  userId,
  onSuccess,
  className,
}: MyComponentProps) {
  const [isActive, setIsActive] = React.useState(false);
  const queryClient = useQueryClient();

  // TanStack Query - fetch data
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  // TanStack Query - mutation
  const updateUser = useMutation({
    mutationFn: async (data: { active: boolean }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      onSuccess?.();
    },
  });

  const handleClick = React.useCallback(() => {
    const newActive = !isActive;
    setIsActive(newActive);
    updateUser.mutate({ active: newActive });
  }, [isActive, updateUser]);

  return (
    <div className={cn('flex flex-col gap-4 p-4 bg-background', className)}>
      <h2 className="text-2xl font-bold text-foreground">
        {user?.name}
      </h2>

      <Button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2',
          isActive && 'bg-green-600 hover:bg-green-700'
        )}
      >
        <Plus className="w-4 h-4" />
        {isActive ? 'Active' : 'Inactive'}
      </Button>
    </div>
  );
}

export default MyComponent;
```

---

## Quick Reference: Tailwind Common Patterns

### Layout

```typescript
// Flexbox
<div className="flex flex-col gap-4">         // Vertical stack with gap
<div className="flex items-center justify-between">  // Horizontal with space-between

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Spacing

```typescript
// Padding & Margin (0.25rem units)
className="p-4 px-6 py-2 m-4 mx-auto"

// Gap
className="gap-2 gap-x-4 gap-y-2"
```

### Colors (Theme-aware)

```typescript
// Background
className="bg-background bg-primary bg-secondary bg-destructive"

// Text
className="text-foreground text-primary text-muted-foreground"

// Border
className="border border-border border-primary"

// Opacity
className="bg-primary/90 text-foreground/70"
```

### Responsive

```typescript
className="text-sm md:text-base lg:text-lg"
className="hidden md:block"
className="w-full md:w-1/2 lg:w-1/3"
```

### Dark Mode (Automatic with CSS Variables)

```typescript
// These adapt automatically based on :root and .dark in globals.css
className="bg-background text-foreground"  // White bg in light, dark bg in dark mode
className="bg-card text-card-foreground"   // Card colors adapt
```

---

## Common Mistakes to Avoid

### ❌ DON'T

1. **Don't use MUI or other component libraries** - Use ShadCN/Radix UI
   ```typescript
   // ❌ Wrong
   import { Button } from '@mui/material';

   // ✅ Correct
   import { Button } from '@/components/ui/button';
   ```

2. **Don't use inline styles** - Use Tailwind classes
   ```typescript
   // ❌ Wrong
   <div style={{ padding: '16px', backgroundColor: '#0066FF' }}>

   // ✅ Correct
   <div className="p-4 bg-primary">
   ```

3. **Don't manually merge classes** - Use `cn()` utility
   ```typescript
   // ❌ Wrong
   className={`base-class ${condition ? 'conditional' : ''} ${className}`}

   // ✅ Correct
   className={cn("base-class", condition && "conditional", className)}
   ```

4. **Don't use raw fetch without TanStack Query** - Use useQuery/useMutation
   ```typescript
   // ❌ Wrong
   const [data, setData] = useState(null);
   useEffect(() => {
     fetch('/api/users/123').then(res => res.json()).then(setData);
   }, []);

   // ✅ Correct
   const { data } = useQuery({
     queryKey: ['user', '123'],
     queryFn: () => fetch('/api/users/123').then(res => res.json()),
   });
   ```

5. **Don't create custom theme context** - Use next-themes
   ```typescript
   // ❌ Wrong
   const [theme, setTheme] = useState('light');

   // ✅ Correct
   import { useTheme } from 'next-themes';
   const { theme, setTheme } = useTheme();
   ```

6. **Don't skip TypeScript types** - Always type props
   ```typescript
   // ❌ Wrong
   export function MyComponent(props) {

   // ✅ Correct
   interface MyComponentProps {
     userId: string;
     onSuccess?: () => void;
   }
   export function MyComponent({ userId, onSuccess }: MyComponentProps) {
   ```

### ✅ DO

1. **Use ShadCN components** - From `@/components/ui`
2. **Use Tailwind utilities** - For all styling
3. **Use cn() for classes** - From `@/lib/utils`
4. **Use TanStack Query** - For data fetching and caching
5. **Use CSS variables** - Theme-aware colors (`bg-primary`, etc.)
6. **Use cva for variants** - Type-safe component variants
7. **Type everything** - Props, state, API responses
8. **Use Lucide icons** - Or Heroicons
9. **Use next-themes** - For dark mode
10. **Use Clerk** - For authentication

---

## Navigation Guide

| Need to... | Read this resource |
|------------|-------------------|
| Create a component | [component-patterns.md](resources/component-patterns.md) |
| Style with Tailwind | [tailwind-styling.md](resources/tailwind-styling.md) |
| Use ShadCN/Radix UI | [radix-ui-integration.md](resources/radix-ui-integration.md) |
| Fetch data | [data-fetching.md](resources/data-fetching.md) |
| Build forms | [form-patterns.md](resources/form-patterns.md) |
| Organize files | [file-organization.md](resources/file-organization.md) |
| Optimize performance | [performance.md](resources/performance.md) |
| TypeScript patterns | [typescript-standards.md](resources/typescript-standards.md) |

---

## Related Skills

- **adteco-backend-guidelines**: Backend API patterns that frontend consumes
- **error-tracking**: Error tracking with Sentry (applies to frontend too)

---

**Skill Status**: Production-ready for Adteco development
