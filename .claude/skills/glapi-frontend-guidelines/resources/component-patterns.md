# Component Patterns

Complete guide to building React components in Sureshake with Radix UI + Tailwind.

---

## Basic Component Structure

```typescript
import * as React from "react";
import { Button, cn } from "@sureshake/ui";
import { Plus } from "lucide-react";

interface MyComponentProps {
  title: string;
  onAction?: () => void;
  className?: string;
}

export function MyComponent({
  title,
  onAction,
  className,
}: MyComponentProps) {
  const [isActive, setIsActive] = React.useState(false);

  const handleClick = React.useCallback(() => {
    setIsActive(!isActive);
    onAction?.();
  }, [isActive, onAction]);

  return (
    <div className={cn("flex flex-col gap-4 p-4 bg-card", className)}>
      <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>
      <Button onClick={handleClick} className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        {isActive ? "Active" : "Inactive"}
      </Button>
    </div>
  );
}

export default MyComponent;
```

---

## Component with cva Variants

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@sureshake/ui";

const cardVariants = cva(
  "rounded-lg border p-6",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        primary: "bg-primary text-primary-foreground border-primary",
        destructive: "bg-destructive text-destructive-foreground border-destructive",
      },
      size: {
        sm: "p-4 text-sm",
        md: "p-6 text-base",
        lg: "p-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  title?: string;
}

export function Card({
  className,
  variant,
  size,
  title,
  children,
  ...props
}: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, size, className }))} {...props}>
      {title && (
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

// Usage
<Card variant="primary" size="lg" title="Important">
  Content
</Card>
```

---

## Dialog Component Pattern

```typescript
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@sureshake/ui";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void | Promise<void>;
}

export function DeleteDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete {itemName}?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete this item.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Performance Optimizations

### useMemo for Expensive Calculations

```typescript
const sortedItems = React.useMemo(() => {
  return items
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}, [items]);
```

### useCallback for Event Handlers

```typescript
const handleClick = React.useCallback((id: string) => {
  onItemClick?.(id);
}, [onItemClick]);

<Button onClick={() => handleClick(item.id)}>
  Click
</Button>
```

### React.memo for Expensive Components

```typescript
export const ExpensiveCard = React.memo(function ExpensiveCard({
  data,
}: {
  data: ComplexData;
}) {
  // Expensive rendering logic
  return <div>{/* ... */}</div>;
});
```

---

## Common Patterns

### Conditional Rendering

```typescript
// Simple conditional
{isLoading && <LoadingSpinner />}

// If-else with ternary
{isSuccess ? <SuccessMessage /> : <ErrorMessage />}

// Multiple conditions
{status === 'loading' && <LoadingSpinner />}
{status === 'success' && <SuccessMessage />}
{status === 'error' && <ErrorMessage />}
```

### List Rendering

```typescript
<div className="space-y-4">
  {items.map((item) => (
    <Card key={item.id} title={item.name}>
      {item.description}
    </Card>
  ))}
</div>

// With empty state
{items.length === 0 ? (
  <EmptyState />
) : (
  items.map((item) => <ItemCard key={item.id} item={item} />)
)}
```

### Controlled Input

```typescript
const [value, setValue] = React.useState("");

<Input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text"
/>
```

---

## Best Practices

1. **Always provide className prop** for composability
2. **Use React.useCallback** for callbacks passed to children
3. **Use React.useMemo** for expensive calculations
4. **Extract repeated JSX** into components
5. **Keep components focused** on single responsibility
6. **Type all props** with TypeScript interfaces
7. **Export component and default** for flexibility
8. **Use cn() utility** for merging classes
