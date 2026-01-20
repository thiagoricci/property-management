# Phase 2: Dashboard Implementation Plan

## Overview

Implement admin dashboard for AI Property Management System using Next.js, React, and Shadcn UI.

## Technology Stack

- **Frontend**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **State Management**: React Context API + React Query
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API / Axios
- **Icons**: Lucide React

## Architecture

- Next.js dashboard will run on port 3001 (or configured port)
- Express backend continues on port 3000
- Dashboard communicates with backend via REST API
- JWT-based authentication

## Implementation Steps

### Step 7: Build Simple Admin Dashboard

**Actions:**

1. Set up Next.js project with TypeScript
2. Install and configure Shadcn UI with Tailwind CSS
3. Create project structure for Next.js dashboard
4. Set up authentication (JWT-based login page)
5. Create dashboard home page layout with navigation
6. Implement API endpoint: GET /api/dashboard/stats (overview data)
7. Display open maintenance requests count
8. Display recent conversations (last 10)
9. Display properties list overview
10. Test login and dashboard access

**Validation**: You can log in and see overview of activity

### Step 8: Properties Management Interface

**Actions:**

1. Create properties list page
2. Implement API endpoint: GET /api/properties (with pagination)
3. Create "Add Property" form (address, owner_name, owner_email, owner_phone)
4. Implement API endpoint: POST /api/properties
5. Create property detail page
6. Display tenants associated with property
7. Create "Add Tenant" form on property page (name, phone, email, move_in_date)
8. Implement API endpoint: POST /api/tenants
9. Implement edit property functionality
10. Implement API endpoint: PUT /api/properties/:id
11. Add delete property (with confirmation dialog)
12. Implement API endpoint: DELETE /api/properties/:id
13. Test full CRUD operations for properties

**Validation**: You can add property and tenant entirely through the UI

### Step 9: Maintenance Request Management

**Actions:**

1. Create maintenance requests list page
2. Implement API endpoint: GET /api/maintenance-requests (with filters)
3. Add filters: status (open/in_progress/resolved), priority, property
4. Create request detail page
5. Display full description, priority, related conversation, timestamp
6. Add status update dropdown (open → in_progress → resolved)
7. Implement API endpoint: PATCH /api/maintenance-requests/:id/status
8. Add notes/comments field for manager
9. Implement API endpoint: PATCH /api/maintenance-requests/:id/notes
10. Implement "Mark as Resolved" button
11. Send tenant notification when status changes (via backend)
12. Add ability to manually create request
13. Test full request lifecycle

**Validation**: You can see all requests, update status, and tenant gets notified

### Step 10: Conversation History Viewer

**Actions:**

1. Create conversations list page
2. Implement API endpoint: GET /api/conversations (with pagination)
3. Display: date, tenant name, channel, message preview
4. Add search by tenant name or keyword
5. Implement API endpoint: GET /api/conversations/search
6. Create conversation detail view (chat interface style)
7. Display full message history with timestamps
8. Add ability to manually send message to tenant
9. Implement API endpoint: POST /api/conversations/:id/reply
10. Add "flag" button for problematic AI responses
11. Implement API endpoint: PATCH /api/conversations/:id/flag
12. Show which conversations led to maintenance requests
13. Test conversation viewing and management

**Validation**: You can search conversations and see full message history

## Project Structure

```
property-management/
├── dashboard/                    # Next.js application
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── properties/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── maintenance/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── conversations/
│   │   │       ├── page.tsx
│   │   │       └── [id]/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # Shadcn UI components
│   │   ├── layout/
│   │   ├── properties/
│   │   ├── maintenance/
│   │   └── conversations/
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── auth.ts              # Auth utilities
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProperties.ts
│   │   ├── useMaintenance.ts
│   │   └── useConversations.ts
│   ├── types/
│   │   ├── property.ts
│   │   ├── tenant.ts
│   │   ├── maintenance.ts
│   │   └── conversation.ts
│   └── contexts/
│       └── AuthContext.tsx
│
├── src/                         # Existing Express backend
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── services/
│
└── server.js                    # Express server
```

## Backend API Endpoints Required

### Authentication

```
POST /api/auth/login          # User login, returns JWT
POST /api/auth/logout         # User logout
```

### Dashboard

```
GET  /api/dashboard/stats     # Dashboard overview stats
GET  /api/conversations/recent # Recent conversations (limit 10)
```

### Properties

```
GET    /api/properties           # List all properties (paginated)
POST   /api/properties           # Create new property
GET    /api/properties/:id       # Get property details
PUT    /api/properties/:id       # Update property
DELETE /api/properties/:id       # Delete property
GET    /api/properties/:id/tenants  # Get property tenants
```

### Tenants

```
GET    /api/tenants             # List all tenants
POST   /api/tenants             # Create new tenant
GET    /api/tenants/:id         # Get tenant details
PUT    /api/tenants/:id         # Update tenant
DELETE /api/tenants/:id         # Delete tenant
```

### Maintenance Requests

```
GET    /api/maintenance-requests           # List requests (with filters)
POST   /api/maintenance-requests           # Create request
GET    /api/maintenance-requests/:id       # Get request details
PATCH  /api/maintenance-requests/:id/status # Update status
PATCH  /api/maintenance-requests/:id/notes  # Update notes
DELETE /api/maintenance-requests/:id       # Delete request
```

### Conversations

```
GET    /api/conversations               # List conversations (paginated)
GET    /api/conversations/search        # Search conversations
GET    /api/conversations/:id           # Get conversation details
POST   /api/conversations/:id/reply     # Send manual reply
PATCH  /api/conversations/:id/flag      # Toggle flag status
GET    /api/conversations/flagged       # Get flagged conversations
```

## Success Criteria

### Step 7

- User can log in with valid credentials
- Dashboard displays accurate stats
- Recent conversations load correctly
- Properties list shows all properties

### Step 8

- Can create new property
- Can view property details
- Can add tenant to property
- Can edit and delete properties
- All CRUD operations persist to database

### Step 9

- Can view all maintenance requests
- Filters work correctly
- Can update request status
- Can add notes to requests
- Can create manual requests
- Tenant notifications sent on status change

### Step 10

- Can view all conversations
- Search functionality works
- Can view conversation details
- Can send manual replies
- Can flag problematic conversations
- Related maintenance requests shown

## Estimated Time

- Step 7: 8-10 hours
- Step 8: 10-12 hours
- Step 9: 10-12 hours
- Step 10: 8-10 hours
- **Total: 36-44 hours**

## Next Steps

Begin with Step 7: Set up Next.js project and create basic admin dashboard.
