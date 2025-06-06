# Ticketing System Package Structure

This guide shows how to organize the ticketing system files in your Next.js project.

## Recommended Directory Structure

```
your-nextjs-app/
├── app/
│   ├── api/
│   │   ├── support/
│   │   │   ├── tickets/
│   │   │   │   ├── route.ts                    # GET /api/support/tickets, POST /api/support/tickets
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts                # GET/PATCH /api/support/tickets/[id]
│   │   │   │   │   ├── comments/
│   │   │   │   │   │   └── route.ts            # GET/POST /api/support/tickets/[id]/comments
│   │   │   │   │   ├── follow/
│   │   │   │   │   │   └── route.ts            # POST /api/support/tickets/[id]/follow
│   │   │   │   │   ├── unfollow/
│   │   │   │   │   │   └── route.ts            # POST /api/support/tickets/[id]/unfollow
│   │   │   │   │   ├── is-following/
│   │   │   │   │   │   └── route.ts            # GET /api/support/tickets/[id]/is-following
│   │   │   │   │   ├── followers/
│   │   │   │   │   │   └── route.ts            # GET /api/support/tickets/[id]/followers
│   │   │   │   │   └── add-follower/
│   │   │   │   │       └── route.ts            # POST /api/support/tickets/[id]/add-follower
│   │   │   │   └── followed/
│   │   │   │       └── route.ts                # GET /api/support/tickets/followed
│   │   │   └── upload/
│   │   │       └── route.ts                    # POST /api/support/upload
│   │   └── admin/
│   │       └── support/
│   │           └── tickets/
│   │               ├── route.ts                 # Admin ticket management
│   │               └── [id]/
│   │                   ├── route.ts             # Admin single ticket
│   │                   ├── status/
│   │                   │   └── route.ts         # Update status
│   │                   ├── priority/
│   │                   │   └── route.ts         # Update priority
│   │                   ├── assign/
│   │                   │   └── route.ts         # Assign ticket
│   │                   ├── unassign/
│   │                   │   └── route.ts         # Unassign ticket
│   │                   ├── comments/
│   │                   │   └── route.ts         # Admin comments
│   │                   └── time-entries/
│   │                       └── route.ts         # Time tracking
│   │
│   ├── support/
│   │   ├── page.tsx                            # Support tickets list page
│   │   ├── create/
│   │   │   └── page.tsx                        # Create ticket page
│   │   └── [id]/
│   │       └── page.tsx                        # Single ticket view
│   │
│   └── admin/
│       └── support/
│           ├── page.tsx                        # Admin support dashboard
│           ├── create/
│           │   └── page.tsx                    # Admin create ticket
│           └── [id]/
│               └── page.tsx                    # Admin ticket view
│
├── components/
│   ├── ui/                                     # Your existing UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   └── ...
│   │
│   └── support/
│       ├── StatusBadge.tsx                     # Status/Priority badges
│       ├── FollowTicketButton.tsx              # Follow/unfollow button
│       ├── TicketFollowers.tsx                 # Display followers
│       ├── AddFollowerDropdown.tsx             # Add follower dropdown
│       ├── TicketList.tsx                      # Reusable ticket list
│       ├── TicketForm.tsx                      # Create/edit ticket form
│       ├── CommentList.tsx                     # Display comments
│       ├── CommentForm.tsx                     # Add comment form
│       └── FileUpload.tsx                      # File upload component
│
├── lib/
│   ├── db/
│   │   ├── client.ts                           # Database client setup
│   │   ├── schema/
│   │   │   ├── index.ts                        # Export all schemas
│   │   │   ├── users.ts                        # Users table schema
│   │   │   ├── organizations.ts                # Organizations schema
│   │   │   └── support-tickets.ts              # Support ticket schemas
│   │   │
│   │   └── dao/
│   │       ├── support-tickets.ts              # Ticket DAO functions
│   │       ├── support-tickets-admin.ts        # Admin ticket DAOs
│   │       ├── ticket-followers.ts             # Follower DAOs
│   │       └── users.ts                        # User/org helper DAOs
│   │
│   ├── hooks/
│   │   ├── useTickets.ts                       # Custom hook for tickets
│   │   ├── useTicketComments.ts                # Hook for comments
│   │   └── useTicketFollowers.ts               # Hook for followers
│   │
│   └── utils/
│       ├── support-helpers.ts                  # Helper functions
│       └── file-upload.ts                      # File upload utilities
│
├── types/
│   └── support.ts                              # TypeScript type definitions
│
└── public/
    └── uploads/                                # Local file storage (if not using cloud)
```

## Creating a Standalone Package

If you want to create a reusable package, structure it like this:

```
ticketing-system/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                                # Main export file
│   ├── components/
│   │   └── [all UI components]
│   ├── api/
│   │   └── [all API route handlers]
│   ├── db/
│   │   ├── schema.ts
│   │   └── dao.ts
│   ├── hooks/
│   │   └── [all custom hooks]
│   └── types/
│       └── index.ts
└── dist/                                       # Compiled output
```

### Package.json for Standalone Package

```json
{
  "name": "@your-org/ticketing-system",
  "version": "1.0.0",
  "description": "Portable ticketing system for Next.js apps",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepare": "npm run build"
  },
  "peerDependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@clerk/nextjs": "^5.0.0",
    "drizzle-orm": "^0.29.0"
  },
  "dependencies": {
    "date-fns": "^3.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Installation in Target Project

### Method 1: Copy Files Directly

1. Copy the entire structure into your project
2. Update import paths as needed
3. Install required dependencies

### Method 2: Create NPM Package

1. Structure as standalone package
2. Build and publish to npm
3. Install in target project:
   ```bash
   npm install @your-org/ticketing-system
   ```

### Method 3: Git Submodule

1. Create a separate repository for the ticketing system
2. Add as submodule to your projects:
   ```bash
   git submodule add https://github.com/your-org/ticketing-system.git lib/ticketing-system
   ```

## Configuration File

Create a `ticketing.config.ts` in your project root:

```typescript
export const ticketingConfig = {
  // Status options
  statuses: [
    { value: 'open', label: 'Open', color: 'blue' },
    { value: 'in_progress', label: 'In Progress', color: 'yellow' },
    { value: 'resolved', label: 'Resolved', color: 'green' },
    { value: 'closed', label: 'Closed', color: 'gray' }
  ],
  
  // Priority options
  priorities: [
    { value: 'low', label: 'Low', color: 'green' },
    { value: 'medium', label: 'Medium', color: 'yellow' },
    { value: 'high', label: 'High', color: 'red' }
  ],
  
  // Feature flags
  features: {
    fileUploads: true,
    followers: true,
    adminPanel: true,
    timeTracking: true,
    emailNotifications: false
  },
  
  // File upload settings
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    storageProvider: 'supabase' // or 's3', 'local'
  },
  
  // Email settings (if enabled)
  email: {
    from: 'support@yourapp.com',
    provider: 'resend' // or 'sendgrid', 'postmark'
  }
}
```

## Migration Script

Create a migration script to set up the system in new projects:

```typescript
// scripts/setup-ticketing.ts
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

async function setupTicketingSystem() {
  console.log('🎫 Setting up Ticketing System...')
  
  // 1. Install dependencies
  console.log('📦 Installing dependencies...')
  execSync('npm install date-fns uuid @supabase/supabase-js', { stdio: 'inherit' })
  
  // 2. Create directory structure
  console.log('📁 Creating directories...')
  const dirs = [
    'app/api/support/tickets',
    'app/support/create',
    'app/support/[id]',
    'components/support',
    'lib/db/schema',
    'lib/db/dao',
    'lib/hooks',
    'types'
  ]
  
  dirs.forEach(dir => {
    fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true })
  })
  
  // 3. Copy files (implement based on your setup)
  console.log('📄 Copying files...')
  // ... copy logic here
  
  // 4. Run database migrations
  console.log('🗄️ Running database migrations...')
  // ... migration logic here
  
  console.log('✅ Ticketing system setup complete!')
}

setupTicketingSystem()
```

## Environment Variables Template

Create a `.env.ticketing.example`:

```env
# Ticketing System Configuration
TICKETING_ENABLED=true
TICKETING_ADMIN_EMAILS=admin@example.com,support@example.com

# File Upload
TICKETING_MAX_FILE_SIZE=10485760
TICKETING_ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# Email Notifications (optional)
TICKETING_EMAIL_ENABLED=false
TICKETING_EMAIL_FROM=support@yourapp.com
TICKETING_EMAIL_PROVIDER=resend
TICKETING_EMAIL_API_KEY=

# Storage Provider
TICKETING_STORAGE_PROVIDER=supabase
TICKETING_STORAGE_BUCKET=support-tickets
```

This structure makes the ticketing system easily portable and maintainable across multiple projects.