# Ticketing System Implementation Guide

A portable ticketing/support system that can be extracted from Kurrent.AI and deployed to any Next.js application with Supabase and Clerk authentication.

## System Overview

This ticketing system provides:
- **Support ticket creation and management**
- **Comment system for ticket communication**
- **File upload/attachment support**
- **Follower system for ticket notifications**
- **Admin functionality** (assign, status changes, priority updates)
- **Time tracking** (admin feature)
- **Email notifications** (optional)

## Prerequisites

Your target application must have:
- Next.js (App Router)
- Supabase/PostgreSQL database
- Clerk authentication
- File storage solution (S3, Supabase Storage, etc.)

## Implementation Steps

### Step 1: Database Setup

#### 1.1 Create the Database Tables

Create these tables in your Supabase/PostgreSQL database:

```sql
-- Users table (if not already present)
CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY,
    "clerk_id" varchar(255) UNIQUE NOT NULL,
    "email" varchar(255) UNIQUE NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Organizations table (if not already present)
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" serial PRIMARY KEY,
    "clerk_id" varchar(255) UNIQUE NOT NULL,
    "name" varchar(255) NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "assignee_id" integer REFERENCES "users"("id"),
    "title" varchar(255) NOT NULL,
    "description" text NOT NULL,
    "status" varchar(50) DEFAULT 'open' NOT NULL,
    "priority" varchar(50) DEFAULT 'medium' NOT NULL,
    "attachments" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
);

-- Support ticket comments table
CREATE TABLE IF NOT EXISTS "support_ticket_comments" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "content" text NOT NULL,
    "attachments" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Support ticket followers table
CREATE TABLE IF NOT EXISTS "support_ticket_followers" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("ticket_id", "user_id"),
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_support_tickets_user_id" ON "support_tickets"("user_id");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_organization_id" ON "support_tickets"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "idx_support_ticket_comments_ticket_id" ON "support_ticket_comments"("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_support_ticket_followers_user_id" ON "support_ticket_followers"("user_id");
```

#### 1.2 Create Triggers for Updated Timestamps

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on support_tickets
CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Step 2: TypeScript Schema Definitions

Create these TypeScript schema files in your project:

#### `/lib/db/schema/support-tickets.ts`

```typescript
import { pgTable, serial, integer, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'
import { organizations } from './organizations'

// Attachment type definition
export type Attachment = {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: Date;
}

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  assigneeId: integer('assignee_id').references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('open'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  attachments: jsonb('attachments').$type<Attachment[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const supportTicketComments = pgTable('support_ticket_comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => supportTickets.id),
  userId: integer('user_id').notNull().references(() => users.id),
  isAdmin: boolean('is_admin').notNull().default(false),
  content: text('content').notNull(),
  attachments: jsonb('attachments').$type<Attachment[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const supportTicketFollowers = pgTable('support_ticket_followers', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => supportTickets.id),
  userId: integer('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Type inferences
export type SupportTicket = typeof supportTickets.$inferSelect
export type NewSupportTicket = typeof supportTickets.$inferInsert
export type SupportTicketComment = typeof supportTicketComments.$inferSelect
export type NewSupportTicketComment = typeof supportTicketComments.$inferInsert
export type SupportTicketFollower = typeof supportTicketFollowers.$inferSelect
export type NewSupportTicketFollower = typeof supportTicketFollowers.$inferInsert
```

### Step 3: Data Access Layer (DAO)

Create DAO functions for database operations:

#### `/lib/db/dao/support-tickets.ts`

```typescript
import { db } from '../client'
import { 
  supportTickets, 
  supportTicketComments, 
  supportTicketFollowers,
  SupportTicket,
  NewSupportTicket,
  NewSupportTicketComment 
} from '../schema/support-tickets'
import { eq, and, desc, inArray, or } from 'drizzle-orm'

// Get tickets for a specific user in an organization
export const getSupportTicketsByUser = async (userId: number, organizationId: number) => {
  return db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, userId),
        eq(supportTickets.organizationId, organizationId)
      )
    )
    .orderBy(desc(supportTickets.createdAt))
}

// Get all tickets for an organization
export const getSupportTickets = async (organizationId: number) => {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.organizationId, organizationId))
    .orderBy(desc(supportTickets.createdAt))
}

// Get a single ticket by ID
export const getSupportTicketById = async (id: number) => {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1)
    .then((results) => results[0] || null)
}

// Create a new ticket
export const createSupportTicket = async (data: NewSupportTicket): Promise<SupportTicket> => {
  const result = await db
    .insert(supportTickets)
    .values(data)
    .returning()
  
  return result[0]
}

// Update a ticket
export const updateSupportTicket = async (id: number, data: Partial<NewSupportTicket>) => {
  const result = await db
    .update(supportTickets)
    .set(data)
    .where(eq(supportTickets.id, id))
    .returning()
  
  return result[0]
}

// Get comments for a ticket
export const getSupportTicketComments = async (ticketId: number) => {
  return db
    .select()
    .from(supportTicketComments)
    .where(eq(supportTicketComments.ticketId, ticketId))
    .orderBy(supportTicketComments.createdAt)
}

// Create a comment
export const createSupportTicketComment = async (data: NewSupportTicketComment) => {
  const result = await db
    .insert(supportTicketComments)
    .values(data)
    .returning()
  
  return result[0]
}

// Follow a ticket
export const followTicket = async (ticketId: number, userId: number) => {
  try {
    await db
      .insert(supportTicketFollowers)
      .values({ ticketId, userId })
      .onConflictDoNothing()
  } catch (error) {
    // Handle if already following
  }
}

// Unfollow a ticket
export const unfollowTicket = async (ticketId: number, userId: number) => {
  await db
    .delete(supportTicketFollowers)
    .where(
      and(
        eq(supportTicketFollowers.ticketId, ticketId),
        eq(supportTicketFollowers.userId, userId)
      )
    )
}

// Get followers for a ticket
export const getTicketFollowers = async (ticketId: number) => {
  return db
    .select()
    .from(supportTicketFollowers)
    .where(eq(supportTicketFollowers.ticketId, ticketId))
}

// Check if user is following a ticket
export const isFollowingTicket = async (ticketId: number, userId: number) => {
  const result = await db
    .select()
    .from(supportTicketFollowers)
    .where(
      and(
        eq(supportTicketFollowers.ticketId, ticketId),
        eq(supportTicketFollowers.userId, userId)
      )
    )
    .limit(1)
  
  return result.length > 0
}

// Get tickets followed by a user
export const getFollowedTickets = async (userId: number, organizationId: number) => {
  return db
    .select({
      ticket: supportTickets,
    })
    .from(supportTickets)
    .innerJoin(
      supportTicketFollowers,
      eq(supportTickets.id, supportTicketFollowers.ticketId)
    )
    .where(
      and(
        eq(supportTicketFollowers.userId, userId),
        eq(supportTickets.organizationId, organizationId)
      )
    )
    .orderBy(desc(supportTickets.updatedAt))
}
```

### Step 4: API Routes

Create these API routes in your Next.js app:

#### `/app/api/support/tickets/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { createClerkClient } from '@clerk/nextjs/server'
import { 
  createSupportTicket, 
  getSupportTickets,
  ensureUserExists,
  ensureOrganizationExists 
} from '@/lib/db/dao/support-tickets'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    const userId = auth.userId
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { title, description, priority, attachments } = await request.json()

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Get user from Clerk
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    const clerkUser = await clerkClient.users.getUser(userId)
    
    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress

    if (!primaryEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Ensure user exists in database
    const userResult = await ensureUserExists(userId, primaryEmail)

    // Get organization
    if (!auth?.orgId) {
      return NextResponse.json({ 
        error: "No organization found. Please select an organization first." 
      }, { status: 400 })
    }
    
    const clerkOrg = await clerkClient.organizations.getOrganization({ 
      organizationId: auth.orgId 
    })
    
    const orgResult = await ensureOrganizationExists(auth.orgId, clerkOrg.name)

    // Create ticket
    const ticket = await createSupportTicket({
      userId: userResult.id,
      organizationId: orgResult.id,
      title,
      description,
      priority: priority || 'medium',
      status: 'open',
      attachments: attachments || []
    })
    
    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    const userId = auth.userId
    
    if (!userId || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and org from database
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    const clerkUser = await clerkClient.users.getUser(userId)
    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress

    const userResult = await ensureUserExists(userId, primaryEmail!)
    const clerkOrg = await clerkClient.organizations.getOrganization({ 
      organizationId: auth.orgId 
    })
    const orgResult = await ensureOrganizationExists(auth.orgId, clerkOrg.name)

    // Get tickets
    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view')
    
    let tickets
    if (view === 'followed') {
      tickets = await getFollowedTickets(userResult.id, orgResult.id)
    } else if (view === 'my-tickets') {
      tickets = await getSupportTicketsByUser(userResult.id, orgResult.id)
    } else {
      tickets = await getSupportTickets(orgResult.id)
    }
    
    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}
```

#### Additional API Routes Needed:

1. **`/app/api/support/tickets/[id]/route.ts`** - Get/Update single ticket
2. **`/app/api/support/tickets/[id]/comments/route.ts`** - Manage comments
3. **`/app/api/support/tickets/[id]/follow/route.ts`** - Follow/unfollow
4. **`/app/api/support/tickets/[id]/followers/route.ts`** - Get followers
5. **`/app/api/support/upload/route.ts`** - File uploads

### Step 5: UI Components

Create these reusable UI components:

#### `/components/support/StatusBadge.tsx`

```typescript
import React from 'react'

type StatusBadgeProps = {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formattedStatus = status.replace(/_/g, ' ')
  
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)} ${className}`}>
      {formattedStatus}
    </span>
  )
}

export function PriorityBadge({ priority, className = '' }: { priority: string; className?: string }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(priority)} ${className}`}>
      {priority} priority
    </span>
  )
}
```

#### `/components/support/FollowTicketButton.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface FollowTicketButtonProps {
  ticketId: number
  isFollowing: boolean
  onFollowChange?: (isFollowing: boolean) => void
}

export function FollowTicketButton({ 
  ticketId, 
  isFollowing: initialIsFollowing,
  onFollowChange 
}: FollowTicketButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isLoading, setIsLoading] = useState(false)

  const handleToggleFollow = async () => {
    setIsLoading(true)
    try {
      const endpoint = isFollowing 
        ? `/api/support/tickets/${ticketId}/unfollow`
        : `/api/support/tickets/${ticketId}/follow`
      
      const response = await fetch(endpoint, { method: 'POST' })
      
      if (response.ok) {
        setIsFollowing(!isFollowing)
        onFollowChange?.(!isFollowing)
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={handleToggleFollow}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : (isFollowing ? 'Unfollow' : 'Follow')}
    </Button>
  )
}
```

### Step 6: Page Components

Create the main page components:

#### `/app/support/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge, PriorityBadge } from '@/components/support/StatusBadge'
import { formatDistanceToNow } from 'date-fns'

export default function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all')

  useEffect(() => {
    fetchTickets()
  }, [view])

  const fetchTickets = async () => {
    try {
      const params = view !== 'all' ? `?view=${view}` : ''
      const response = await fetch(`/api/support/tickets${params}`)
      if (response.ok) {
        const data = await response.json()
        setTickets(data)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <Link href="/support/create">
          <Button>Create New Ticket</Button>
        </Link>
      </div>

      <div className="mb-4 space-x-2">
        <Button 
          variant={view === 'all' ? 'default' : 'outline'}
          onClick={() => setView('all')}
        >
          All Tickets
        </Button>
        <Button 
          variant={view === 'my-tickets' ? 'default' : 'outline'}
          onClick={() => setView('my-tickets')}
        >
          My Tickets
        </Button>
        <Button 
          variant={view === 'followed' ? 'default' : 'outline'}
          onClick={() => setView('followed')}
        >
          Following
        </Button>
      </div>

      <div className="space-y-4">
        {tickets.map((ticket: any) => (
          <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link href={`/support/${ticket.id}`}>
                  <h3 className="text-lg font-semibold hover:text-blue-600">
                    {ticket.title}
                  </h3>
                </Link>
                <p className="text-gray-600 mt-1 line-clamp-2">
                  {ticket.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>#{ticket.id}</span>
                  <span>
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### `/app/support/[id]/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, PriorityBadge } from '@/components/support/StatusBadge'
import { FollowTicketButton } from '@/components/support/FollowTicketButton'
import { formatDistanceToNow } from 'date-fns'

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string
  const [ticket, setTicket] = useState<any>(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTicket()
    fetchComments()
    checkFollowStatus()
  }, [ticketId])

  const fetchTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setTicket(data)
      }
    } catch (error) {
      console.error('Error fetching ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const checkFollowStatus = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/is-following`)
      if (response.ok) {
        const { isFollowing } = await response.json()
        setIsFollowing(isFollowing)
      }
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      })

      if (response.ok) {
        setNewComment('')
        fetchComments()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!ticket) {
    return <div>Ticket not found</div>
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{ticket.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Ticket #{ticket.id}</span>
              <span>
                Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
          <FollowTicketButton 
            ticketId={ticket.id} 
            isFollowing={isFollowing}
            onFollowChange={setIsFollowing}
          />
        </div>

        <div className="prose max-w-none mb-8">
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Comments Section */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          
          <div className="space-y-4 mb-6">
            {comments.map((comment: any) => (
              <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">
                    {comment.isAdmin ? 'Support Team' : 'You'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <div className="space-y-4">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
            />
            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
              Add Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Step 7: File Upload Support

For file uploads, you'll need to integrate with your storage solution:

#### `/app/api/support/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'

// Example using Supabase Storage
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = `support-tickets/${auth.userId}/${fileName}`

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file)

    if (error) {
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath)

    return NextResponse.json({
      id: uuidv4(),
      name: file.name,
      url: publicUrl,
      size: file.size,
      contentType: file.type,
      createdAt: new Date()
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
```

### Step 8: Helper Functions

Create these helper functions for user/org management:

#### `/lib/db/dao/users.ts`

```typescript
import { db } from '../client'
import { users, organizations } from '../schema'
import { eq } from 'drizzle-orm'

export async function ensureUserExists(clerkId: string, email: string) {
  // Check if user exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (existingUser.length > 0) {
    return existingUser[0]
  }

  // Create new user
  const newUser = await db
    .insert(users)
    .values({
      clerkId,
      email,
    })
    .returning()

  return newUser[0]
}

export async function ensureOrganizationExists(clerkId: string, name: string) {
  // Check if organization exists
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkId, clerkId))
    .limit(1)

  if (existingOrg.length > 0) {
    return existingOrg[0]
  }

  // Create new organization
  const newOrg = await db
    .insert(organizations)
    .values({
      clerkId,
      name,
    })
    .returning()

  return newOrg[0]
}
```

### Step 9: Admin Features (Optional)

For admin functionality, create additional routes:

1. **`/app/api/admin/support/tickets/route.ts`** - Admin ticket list
2. **`/app/api/admin/support/tickets/[id]/assign/route.ts`** - Assign tickets
3. **`/app/api/admin/support/tickets/[id]/status/route.ts`** - Change status
4. **`/app/api/admin/support/tickets/[id]/priority/route.ts`** - Change priority

### Step 10: Configuration & Environment Variables

Add these to your `.env.local`:

```env
# Clerk Configuration
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Database
DATABASE_URL=your_database_url

# Storage (if using Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# File Upload Settings
MAX_FILE_SIZE=10485760 # 10MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

### Step 11: Optional Features

#### Email Notifications

To add email notifications:

1. Install an email service (SendGrid, Resend, etc.)
2. Create email templates
3. Add email sending to ticket creation and comment addition

```typescript
// Example with Resend
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendTicketCreatedEmail(ticket: any, userEmail: string) {
  await resend.emails.send({
    from: 'support@yourapp.com',
    to: userEmail,
    subject: `Ticket #${ticket.id}: ${ticket.title}`,
    html: `<p>Your support ticket has been created...</p>`
  })
}
```

#### Real-time Updates

Add real-time updates using Supabase Realtime or Pusher:

```typescript
// Example with Supabase Realtime
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Subscribe to ticket updates
const subscription = supabase
  .channel('ticket-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'support_tickets',
    filter: `id=eq.${ticketId}`
  }, (payload) => {
    // Handle update
  })
  .subscribe()
```

### Migration Checklist

When implementing in your project:

1. [ ] Set up database tables and migrations
2. [ ] Install required dependencies
3. [ ] Create TypeScript schema files
4. [ ] Implement DAO functions
5. [ ] Set up API routes
6. [ ] Create UI components
7. [ ] Add page components
8. [ ] Configure file uploads
9. [ ] Set up user/org sync functions
10. [ ] Add environment variables
11. [ ] Test all functionality
12. [ ] (Optional) Add admin features
13. [ ] (Optional) Set up email notifications
14. [ ] (Optional) Add real-time updates

### Dependencies to Install

```json
{
  "dependencies": {
    "@clerk/nextjs": "^5.x",
    "drizzle-orm": "^0.x",
    "postgres": "^3.x",
    "@supabase/supabase-js": "^2.x",
    "date-fns": "^3.x",
    "uuid": "^9.x"
  },
  "devDependencies": {
    "drizzle-kit": "^0.x",
    "@types/uuid": "^9.x"
  }
}
```

### Customization Points

The system is designed to be customizable:

1. **Statuses**: Modify the status options in the schema and UI
2. **Priorities**: Add/remove priority levels
3. **Categories**: Add a categories system
4. **Custom Fields**: Extend the schema with additional fields
5. **Permissions**: Add role-based access control
6. **Workflows**: Implement custom status workflows
7. **Integrations**: Connect with external systems

This implementation provides a complete, production-ready ticketing system that can be deployed to any Next.js application with minimal modifications.