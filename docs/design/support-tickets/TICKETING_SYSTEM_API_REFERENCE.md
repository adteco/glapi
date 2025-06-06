# Ticketing System API Reference

## Public Support API Endpoints

### Tickets

#### Create Ticket
```
POST /api/support/tickets
Body: {
  title: string,
  description: string,
  priority?: 'low' | 'medium' | 'high',
  attachments?: Attachment[]
}
Response: SupportTicket
```

#### List Tickets
```
GET /api/support/tickets
Query Params:
  - view?: 'all' | 'my-tickets' | 'followed'
Response: SupportTicket[]
```

#### Get Single Ticket
```
GET /api/support/tickets/[id]
Response: SupportTicket
```

#### Update Ticket
```
PATCH /api/support/tickets/[id]
Body: Partial<SupportTicket>
Response: SupportTicket
```

### Comments

#### List Comments
```
GET /api/support/tickets/[id]/comments
Response: SupportTicketComment[]
```

#### Add Comment
```
POST /api/support/tickets/[id]/comments
Body: {
  content: string,
  attachments?: Attachment[]
}
Response: SupportTicketComment
```

### Followers

#### Follow Ticket
```
POST /api/support/tickets/[id]/follow
Response: { success: boolean }
```

#### Unfollow Ticket
```
POST /api/support/tickets/[id]/unfollow
Response: { success: boolean }
```

#### Check Follow Status
```
GET /api/support/tickets/[id]/is-following
Response: { isFollowing: boolean }
```

#### Get Ticket Followers
```
GET /api/support/tickets/[id]/followers
Response: { followers: User[] }
```

#### Add Follower (Admin)
```
POST /api/support/tickets/[id]/add-follower
Body: { userId: number }
Response: { success: boolean }
```

#### Get Followed Tickets
```
GET /api/support/tickets/followed
Response: SupportTicket[]
```

### File Upload

#### Upload File
```
POST /api/support/upload
Body: FormData with 'file' field
Response: Attachment
```

## Admin API Endpoints

### Ticket Management

#### List All Tickets (Admin View)
```
GET /api/admin/support/tickets
Query Params:
  - status?: string
  - assigneeId?: number
  - priority?: string
Response: SupportTicket[]
```

#### Get Ticket Details (Admin)
```
GET /api/admin/support/tickets/[id]
Response: SupportTicket with additional admin fields
```

#### Update Ticket Status
```
PATCH /api/admin/support/tickets/[id]/status
Body: { status: string }
Response: SupportTicket
```

#### Update Ticket Priority
```
PATCH /api/admin/support/tickets/[id]/priority
Body: { priority: 'low' | 'medium' | 'high' }
Response: SupportTicket
```

#### Assign Ticket
```
POST /api/admin/support/tickets/[id]/assign
Body: { assigneeId: number }
Response: SupportTicket
```

#### Unassign Ticket
```
POST /api/admin/support/tickets/[id]/unassign
Response: SupportTicket
```

#### Add Admin Comment
```
POST /api/admin/support/tickets/[id]/comments
Body: {
  content: string,
  isInternal?: boolean,
  attachments?: Attachment[]
}
Response: SupportTicketComment
```

### Time Tracking (Admin)

#### Add Time Entry
```
POST /api/admin/support/tickets/[id]/time-entries
Body: {
  minutes: number,
  description: string
}
Response: TimeEntry
```

#### Get Time Entries
```
GET /api/admin/support/tickets/[id]/time-entries
Response: TimeEntry[]
```

## Data Types

### SupportTicket
```typescript
{
  id: number;
  userId: number;
  organizationId: number;
  assigneeId?: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}
```

### SupportTicketComment
```typescript
{
  id: number;
  ticketId: number;
  userId: number;
  isAdmin: boolean;
  content: string;
  attachments: Attachment[];
  createdAt: Date;
}
```

### Attachment
```typescript
{
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: Date;
}
```

## Error Responses

All endpoints return standard error responses:

```typescript
{
  error: string;
  details?: any;
}
```

Common HTTP status codes:
- 400: Bad Request (missing required fields)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error