# Icon Usage Guidelines

This document defines the standard icons used throughout the GLAPI application for consistent user experience.

## Core Action Icons

### Primary Actions

| Action | Icon | Component | Usage | Keyboard Shortcut |
|--------|------|-----------|-------|-------------------|
| **View** | Eye | `<Eye className="h-4 w-4" />` | View details of an entity | - |
| **Edit** | Pencil | `<Pencil className="h-4 w-4" />` | Edit/modify an entity | - |
| **Delete** | Trash2 | `<Trash2 className="h-4 w-4" />` | Delete/remove an entity | - |
| **Add/Create** | Plus | `<Plus className="h-4 w-4" />` | Create new entity | - |
| **Save** | Check | `<Check className="h-4 w-4" />` | Save changes | Cmd/Ctrl + S |
| **Cancel** | X | `<X className="h-4 w-4" />` | Cancel operation | Esc |
| **Download** | Download | `<Download className="h-4 w-4" />` | Download/export data | - |
| **Upload** | Upload | `<Upload className="h-4 w-4" />` | Upload/import data | - |

### Navigation Icons

| Action | Icon | Component | Usage |
|--------|------|-----------|-------|
| **Back** | ArrowLeft | `<ArrowLeft className="h-4 w-4" />` | Go back/return |
| **Forward** | ArrowRight | `<ArrowRight className="h-4 w-4" />` | Go forward/next |
| **Up** | ArrowUp | `<ArrowUp className="h-4 w-4" />` | Move up/scroll up |
| **Down** | ArrowDown | `<ArrowDown className="h-4 w-4" />` | Move down/scroll down |
| **Menu** | Menu | `<Menu className="h-4 w-4" />` | Open menu |
| **More Options** | MoreVertical | `<MoreVertical className="h-4 w-4" />` | More actions menu |
| **External Link** | ExternalLink | `<ExternalLink className="h-4 w-4" />` | Open in new tab/window |

### Entity Type Icons

| Entity | Icon | Component | Usage |
|--------|------|-----------|-------|
| **Building/Company** | Building2 | `<Building2 className="h-4 w-4" />` | Companies, Organizations |
| **Person/User** | User | `<User className="h-4 w-4" />` | Individual contacts, users |
| **Team/Group** | Users | `<Users className="h-4 w-4" />` | Teams, departments |
| **Document** | FileText | `<FileText className="h-4 w-4" />` | Documents, contracts |
| **Invoice** | Receipt | `<Receipt className="h-4 w-4" />` | Invoices, bills |
| **Money/Payment** | DollarSign | `<DollarSign className="h-4 w-4" />` | Payments, transactions |

### Communication Icons

| Type | Icon | Component | Usage |
|------|------|-----------|-------|
| **Email** | Mail | `<Mail className="h-4 w-4" />` | Email addresses |
| **Phone** | Phone | `<Phone className="h-4 w-4" />` | Phone numbers |
| **Website** | Globe | `<Globe className="h-4 w-4" />` | Websites, URLs |
| **Chat** | MessageSquare | `<MessageSquare className="h-4 w-4" />` | Chat, messages |
| **Calendar** | Calendar | `<Calendar className="h-4 w-4" />` | Dates, schedules |

### Status Icons

| Status | Icon | Component | Usage |
|--------|------|-----------|-------|
| **Success** | CheckCircle | `<CheckCircle className="h-4 w-4" />` | Success, completed |
| **Error** | XCircle | `<XCircle className="h-4 w-4" />` | Error, failed |
| **Warning** | AlertTriangle | `<AlertTriangle className="h-4 w-4" />` | Warning, caution |
| **Info** | Info | `<Info className="h-4 w-4" />` | Information |
| **Loading** | Loader2 | `<Loader2 className="h-4 w-4 animate-spin" />` | Loading state |

### Special Actions

| Action | Icon | Component | Usage |
|--------|------|-----------|-------|
| **Search** | Search | `<Search className="h-4 w-4" />` | Search functionality |
| **Filter** | Filter | `<Filter className="h-4 w-4" />` | Filter data |
| **Sort** | ArrowUpDown | `<ArrowUpDown className="h-4 w-4" />` | Sort data |
| **Settings** | Settings | `<Settings className="h-4 w-4" />` | Settings, configuration |
| **Help** | HelpCircle | `<HelpCircle className="h-4 w-4" />` | Help, documentation |
| **Copy** | Copy | `<Copy className="h-4 w-4" />` | Copy to clipboard |
| **Refresh** | RefreshCw | `<RefreshCw className="h-4 w-4" />` | Refresh, reload |

## Implementation Guidelines

### Size Standards
- **Default**: `h-4 w-4` (16x16px) - For inline actions, table rows
- **Small**: `h-3 w-3` (12x12px) - For compact spaces
- **Medium**: `h-5 w-5` (20x20px) - For buttons with text
- **Large**: `h-6 w-6` (24x24px) - For page headers, empty states

### Color Guidelines
- **Default**: Inherit from parent text color
- **Hover**: Use hover states on parent button/link
- **Disabled**: Use `opacity-50` or `text-muted-foreground`
- **Destructive**: Use `text-destructive` for delete actions

### Button Variants with Icons

```tsx
// Icon-only button (tooltip recommended)
<Button variant="ghost" size="icon">
  <Eye className="h-4 w-4" />
  <span className="sr-only">View</span>
</Button>

// Icon with text
<Button variant="outline" size="sm">
  <Pencil className="mr-2 h-4 w-4" />
  Edit
</Button>

// Destructive action
<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
  <Trash2 className="h-4 w-4" />
  <span className="sr-only">Delete</span>
</Button>
```

### Accessibility
- Always include `sr-only` text for icon-only buttons
- Use descriptive aria-labels
- Ensure sufficient color contrast
- Provide keyboard navigation support

### Import Statement
All icons should be imported from `lucide-react`:

```tsx
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Plus, 
  // ... other icons
} from 'lucide-react';
```

## Common Patterns

### Table Row Actions
```tsx
<div className="flex items-center gap-1">
  <Button variant="ghost" size="icon">
    <Eye className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon">
    <Pencil className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

### Empty States
Use larger icons (h-12 w-12) with muted colors for empty states.

### Loading States
Always use `animate-spin` class with Loader2 icon for loading indicators.