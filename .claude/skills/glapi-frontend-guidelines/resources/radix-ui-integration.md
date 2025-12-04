# Radix UI Integration

Guide to using Radix UI primitives in Sureshake via the `@sureshake/ui` package.

---

## Philosophy

**Radix UI provides:**
- **Unstyled primitives** - Full styling control
- **Accessibility built-in** - ARIA, keyboard nav, focus management
- **Composition-based** - Combine primitives as needed
- **Headless** - No opinions on design

**Sureshake wraps Radix with:**
- Tailwind styling
- Consistent design system
- Type-safe props
- Shared component library

---

## Available Components

Import from `@sureshake/ui`:

```typescript
import {
  // Dialogs & Modals
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
  AlertDialog, AlertDialogContent, AlertDialogAction,

  // Dropdowns & Menus
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,

  // Form Inputs
  Input, Label, Textarea, Checkbox, Switch,
  Select, SelectTrigger, SelectContent, SelectItem,

  // Forms
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,

  // Feedback
  Toast, Toaster, useToast, Alert, AlertTitle, AlertDescription,

  // Layout
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Separator,

  // Overlays
  Popover, PopoverTrigger, PopoverContent,

  // Display
  Avatar, AvatarImage, AvatarFallback,
  Badge, Progress, Skeleton,

  // Data
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,

  // Utilities
  Button, cn,
} from '@sureshake/ui';
```

---

## Common Patterns

### Dialog Pattern

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@sureshake/ui';

const [open, setOpen] = React.useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    <div>Content goes here</div>
  </DialogContent>
</Dialog>
```

### Dropdown Menu Pattern

```typescript
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@sureshake/ui';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Select Pattern

```typescript
import { Select, SelectTrigger, SelectContent, SelectItem } from '@sureshake/ui';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Toast Pattern

```typescript
import { useToast } from '@sureshake/ui';

const { toast } = useToast();

toast({
  title: "Success",
  description: "Your changes have been saved.",
});

// With variant
toast({
  variant: "destructive",
  title: "Error",
  description: "Something went wrong.",
});
```

---

## Key Radix Concepts

### Composition

Radix components are designed for composition:

```typescript
<Dialog>
  <DialogTrigger>Open</DialogTrigger>  // Optional
  <DialogContent>                      // Required
    <DialogHeader>                     // Optional wrapper
      <DialogTitle>Title</DialogTitle> // Optional
    </DialogHeader>
    <div>Main content</div>
    <DialogFooter>                     // Optional wrapper
      <Button>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Portals

Some components auto-portal (Dialog, Popover):
- Rendered outside DOM hierarchy
- Prevents z-index issues
- Proper stacking context

### Controlled vs Uncontrolled

```typescript
// Controlled
<Dialog open={open} onOpenChange={setOpen}>

// Uncontrolled
<Dialog defaultOpen>

// Controlled Select
<Select value={value} onValueChange={setValue}>

// Uncontrolled Select
<Select defaultValue="option1">
```

---

## Accessibility

Radix handles most accessibility automatically:

- **Keyboard Navigation** - Tab, Arrow keys, Esc
- **ARIA Attributes** - Proper roles, labels, descriptions
- **Focus Management** - Focus trap in dialogs
- **Screen Reader** - Announcements and labels

**You still need to:**
- Provide descriptive labels
- Use DialogDescription for context
- Ensure color contrast (Tailwind handles this)

---

## Styling Radix Components

All Sureshake wrappers accept `className`:

```typescript
<Dialog>
  <DialogContent className="sm:max-w-[600px] bg-slate-900">
    <DialogHeader className="space-y-3">
      <DialogTitle className="text-2xl">Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

Use `cn()` for conditional styles:

```typescript
<Button
  className={cn(
    "flex items-center gap-2",
    isActive && "bg-green-600 hover:bg-green-700"
  )}
>
```

---

## Best Practices

1. **Import from @sureshake/ui** - Not directly from @radix-ui
2. **Use composition** - Combine primitives as needed
3. **Leverage accessibility** - Radix handles most of it
4. **Style with Tailwind** - Use utility classes
5. **Controlled for complex state** - Uncontrolled for simple cases
6. **Provide labels** - Even if visually hidden
