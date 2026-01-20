# System Architecture

## High-Level Architecture

The AI Property Manager follows a **microservices-inspired monolithic architecture** with clear separation of concerns. This approach allows for rapid development while maintaining the ability to scale individual components later.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Twilio     │  │   SendGrid   │  │   Dashboard  │       │
│  │  (SMS/Voice) │  │   (Email)    │  │  (React/Vue) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway / Express Server                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes: /api/*, /webhooks/*                         │   │
│  │  Middleware: Auth, CORS, Rate Limiting, Logging     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   AI Service │  │Notification  │  │   Action     │       │
│  │  (OpenAI)    │  │  Service     │  │  Executor    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                 │   │
│  │  Tables: properties, tenants, conversations,        │   │
│  │          maintenance_requests, notifications         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Source Code Structure

```
property-management/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection pool
│   │   ├── openai.js            # OpenAI client configuration
│   │   ├── twilio.js            # Twilio client configuration
│   │   └── sendgrid.js          # SendGrid client configuration
│   │
│   ├── routes/
│   │   ├── properties.js        # Property CRUD endpoints
│   │   ├── tenants.js           # Tenant CRUD endpoints
│   │   ├── messages.js          # Message handling endpoints
│   │   ├── maintenance.js       # Maintenance request endpoints
│   │   ├── conversations.js     # Conversation history endpoints
│   │   └── webhooks.js          # External service webhooks
│   │
│   ├── controllers/
│   │   ├── propertyController.js
│   │   ├── tenantController.js
│   │   ├── messageController.js
│   │   ├── maintenanceController.js
│   │   └── conversationController.js
│   │
│   ├── services/
│   │   ├── aiService.js         # OpenAI integration
│   │   ├── notificationService.js
│   │   ├── actionExecutor.js    # Execute AI-extracted actions
│   │   └── conversationService.js
│   │
│   ├── models/
│   │   ├── Property.js
│   │   ├── Tenant.js
│   │   ├── Conversation.js
│   │   ├── MaintenanceRequest.js
│   │   └── Notification.js
│   │
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   ├── errorHandler.js      # Global error handling
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── logger.js            # Request/response logging
│   │
│   └── utils/
│       ├── prompts.js           # AI prompt templates
│       ├── validators.js        # Input validation
│       └── helpers.js           # Utility functions
│
├── public/                      # Static assets (if needed)
├── tests/                       # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── database/
│   ├── migrations/              # Database schema migrations
│   └── seeds/                   # Sample data
│
├── .env                         # Environment variables (not in git)
├── .env.example                 # Environment variable template
├── server.js                    # Application entry point
├── package.json
└── README.md
```

## Key Technical Decisions

### 1. Monolithic Architecture with Service Layer

**Rationale**:

- Faster development for MVP
- Easier deployment and debugging
- Can extract services to microservices later if needed
- Simpler to maintain for a small team

**Trade-offs**:

- Less horizontal scaling initially
- Single point of failure (mitigated by good error handling)

### 2. PostgreSQL as Primary Database

**Rationale**:

- ACID compliance for critical data (maintenance requests, notifications)
- Complex queries for analytics and reporting
- JSONB support for flexible AI response storage
- Strong ecosystem and tooling

### 3. OpenAI GPT API for AI Processing

**Rationale**:

- State-of-the-art natural language understanding
- Easy integration via REST API
- JSON mode for structured action extraction
- Cost-effective with GPT-3.5-turbo

**Considerations**:

- Monitor token usage and costs
- Implement fallback for API failures
- Cache common responses to reduce costs

### 4. Express.js for Backend Framework

**Rationale**:

- Minimal and flexible
- Large ecosystem of middleware
- Easy to learn and debug
- Good performance for API workloads

### 5. React or Vue.js for Dashboard

**Decision pending**: Will be made during Step 7

**Factors to consider**:

- Team familiarity
- Component ecosystem
- Learning curve
- Performance requirements

## Design Patterns

### 1. Service Layer Pattern

Services encapsulate business logic and external API interactions:

```javascript
// Example: aiService.js
class AIService {
  async generateResponse(systemPrompt, conversationHistory, newMessage) {
    // Business logic for AI interaction
  }

  extractActions(aiResponse) {
    // Parse and validate AI responses
  }
}
```

**Benefits**:

- Separates business logic from controllers
- Reusable across different endpoints
- Easier to test in isolation

### 2. Repository Pattern (Simplified)

Models handle database operations with a clean interface:

```javascript
// Example: Property model
class Property {
  static async findById(id) {}
  static async findAll(filters) {}
  static async create(data) {}
  static async update(id, data) {}
  static async delete(id) {}
}
```

**Benefits**:

- Centralized database access
- Easy to add caching or change database
- Consistent query patterns

### 3. Middleware Chain Pattern

Express middleware handles cross-cutting concerns:

```javascript
app.use(logger);
app.use(rateLimiter);
app.use(auth);
app.use(errorHandler);
```

**Benefits**:

- Reusable cross-cutting logic
- Clean separation of concerns
- Easy to add/remove middleware

### 4. Factory Pattern for Notifications

Notification service creates appropriate notification objects:

```javascript
class NotificationService {
  create(type, data) {
    switch (type) {
      case "email":
        return new EmailNotification(data);
      case "sms":
        return new SMSNotification(data);
      case "whatsapp":
        return new WhatsAppNotification(data);
    }
  }
}
```

**Benefits**:

- Easy to add new notification channels
- Consistent interface
- Type-safe notification creation

## Component Relationships

### Core Data Flow: Message Processing

```
Incoming Message (SMS/Email)
    ↓
Webhook Endpoint (/webhooks/twilio/sms)
    ↓
Message Controller
    ↓
  ├─→ Validate & Parse Message
  ├─→ Load Tenant & Property Context
  ├─→ Load Conversation History
  ├─→ AI Service (Generate Response)
  │     ↓
  │   ├─→ Build System Prompt
  │   ├─→ Call OpenAI API
  │   └─→ Extract Actions
  │
  ├─→ Action Executor (Execute Actions)
  │     ↓
  │   ├─→ Create Maintenance Request
  │   ├─→ Send Manager Alert
  │   └─→ Log Notification
  │
  └─→ Response Handler
        ↓
      Send Response (SMS/Email)
        ↓
      Log Conversation
```

### Dashboard Data Flow

```
Dashboard Request
    ↓
API Endpoint (/api/dashboard/stats)
    ↓
Controller
    ↓
  ├─→ Authentication Middleware
  ├─→ Query Database (Aggregations)
  └─→ Return JSON Response
        ↓
    Frontend Renders
```

## Critical Implementation Paths

### 1. AI Response Generation (High Priority)

**Path**: Message → AI Service → OpenAI API → Response → Action Extraction

**Critical Points**:

- System prompt quality determines AI performance
- Conversation history loading must be efficient
- Action extraction must be reliable
- Error handling for API failures

### 2. Maintenance Request Creation (High Priority)

**Path**: AI Action → Action Executor → Database → Notification Service → Manager

**Critical Points**:

- Priority classification accuracy
- Manager notification reliability
- Database transaction integrity
- Tenant confirmation messaging

### 3. Emergency Escalation (Critical)

**Path**: Emergency Detection → Immediate SMS Alert → Manager → Response

**Critical Points**:

- Emergency keyword detection accuracy
- Immediate notification delivery
- Fallback notification channels
- Manager acknowledgment tracking

## Database Schema Design

### Properties Table

```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  owner_email VARCHAR(100) NOT NULL,
  owner_phone VARCHAR(20) NOT NULL,
  amenities JSONB,
  rules JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tenants Table

```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  lease_terms JSONB,
  move_in_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Conversations Table

```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  channel VARCHAR(20) NOT NULL, -- 'sms', 'email', 'whatsapp'
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  ai_actions JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Maintenance Requests Table

```sql
CREATE TABLE maintenance_requests (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  tenant_id INTEGER REFERENCES tenants(id),
  conversation_id INTEGER REFERENCES conversations(id),
  issue_description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL, -- 'emergency', 'urgent', 'normal', 'low'
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

### Notifications Table

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL, -- 'sms', 'email'
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT
);
```

## Security Considerations

### Authentication & Authorization

- JWT-based authentication for dashboard access
- Role-based access control (admin, manager, viewer)
- API key validation for webhooks

### Data Protection

- Encrypt sensitive data at rest (phone numbers, emails)
- Use HTTPS for all communications
- Implement rate limiting to prevent abuse
- Sanitize all user inputs to prevent SQL injection

### API Security

- Validate all incoming requests
- Use parameterized queries
- Implement CORS properly
- Log all external API calls

## Performance Optimization Strategies

### Database

- Add indexes on frequently queried columns (tenant_id, property_id, timestamp)
- Use connection pooling (pg pool)
- Implement query result caching for dashboard stats

### API

- Implement response compression
- Use async/await for non-blocking I/O
- Implement rate limiting to prevent abuse
- Cache AI responses for common queries

### AI Service

- Monitor token usage and optimize prompts
- Implement response caching for common questions
- Use GPT-3.5-turbo for cost efficiency, upgrade to GPT-4 if needed
- Implement fallback responses for API failures

## Scalability Considerations

### Horizontal Scaling

- Stateless API design allows horizontal scaling
- Database read replicas for analytics queries
- CDN for static assets

### Vertical Scaling

- Monitor CPU, memory, and database performance
- Optimize slow queries
- Implement caching layers

### Future Microservices Extraction

- AI Service can be extracted to separate service
- Notification Service can be extracted
- Each service can scale independently
