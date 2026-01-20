# AI Property Manager - Dashboard

Admin dashboard for the AI Property Management System.

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **State Management**: React Context API
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios

## Getting Started

### Prerequisites

1. Backend API server running on port 3000
2. PostgreSQL database initialized
3. Node.js 18+ installed

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Update .env.local with your API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Running the Dashboard

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

The dashboard will be available at `http://localhost:3001`

## Features

### Authentication

- JWT-based authentication
- Secure login with email and password
- Token-based API requests
- Auto-logout on token expiration

### Dashboard Overview

- Real-time statistics
- Total properties and tenants
- Open and urgent maintenance requests
- Recent conversations feed

### Properties Management

- View all properties
- Add new properties
- Edit property details
- Delete properties
- View tenants per property

### Maintenance Requests

- View all maintenance requests
- Filter by status and priority
- Update request status
- Add notes to requests
- View related conversations

### Conversations

- View all conversations
- Search by tenant name or keyword
- View conversation details
- Send manual replies
- Flag problematic conversations

## Default Credentials

```
Email: admin@example.com
Password: admin123
```

## API Endpoints

The dashboard communicates with the backend API at `/api/*`:

- `POST /api/auth/login` - User authentication
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/properties` - List all properties
- `POST /api/properties` - Create new property
- `GET /api/properties/:id` - Get property details
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `GET /api/maintenance-requests` - List maintenance requests
- `POST /api/maintenance-requests` - Create maintenance request
- `PATCH /api/maintenance-requests/:id/status` - Update status
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details

## Project Structure

```
dashboard/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── login/             # Login page
│   │   └── dashboard/          # Dashboard pages
│   │       ├── properties/       # Properties management
│   │       ├── maintenance/      # Maintenance requests
│   │       └── conversations/    # Conversation history
│   ├── components/              # React components
│   │   └── ui/               # Shadcn UI components
│   ├── contexts/               # React contexts
│   │   └── AuthContext.tsx    # Authentication context
│   ├── lib/                    # Utilities
│   │   ├── api.ts             # API client
│   │   └── utils.ts           # Helper functions
│   └── types/                  # TypeScript types
├── public/                     # Static assets
└── package.json
```

## Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS for styling

### Component Design

- Reusable UI components from Shadcn UI
- Consistent design system
- Accessible by default
- Dark mode support

## Deployment

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://your-backend-url/api
```

### Build for Production

```bash
npm run build
```

The build output will be in the `.next` directory.

## Troubleshooting

### API Connection Issues

If the dashboard can't connect to the API:

1. Check if the backend server is running on port 3000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check CORS settings in the backend
4. Review browser console for error messages

### Authentication Issues

If login fails:

1. Verify database has the admin user
2. Check JWT_SECRET is set in backend .env
3. Review server logs for authentication errors
4. Ensure password is correct (admin123)

## License

ISC
