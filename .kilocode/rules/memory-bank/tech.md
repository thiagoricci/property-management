# Technology Stack & Development Setup

## Core Technologies

### Backend

- **Runtime**: Node.js 18+ (LTS version)
- **Framework**: Express.js 4.x
- **Language**: JavaScript (ES6+)

### AI/LLM

- **Provider**: OpenAI
- **Models**: GPT-3.5-turbo (primary), GPT-4 (optional upgrade)
- **API**: OpenAI Chat Completions API with JSON mode

### Database

- **Database**: PostgreSQL 14+
- **Driver**: pg (node-postgres)
- **ORM**: None (using raw queries for simplicity and performance)

### Communication Services

- **SMS/Voice**: Twilio API
- **Email**: Resend API
- **Future**: WhatsApp (Twilio WhatsApp API)

### Frontend

- **Framework**: React or Vue.js (decision pending - Step 7)
- **Styling**: Tailwind CSS or Bootstrap (decision pending)
- **Build Tool**: Vite or Create React App (decision pending)

### Hosting & Infrastructure

- **Options**: AWS, Railway, Render, or DigitalOcean
- **Database Hosting**: Managed PostgreSQL service
- **CDN**: Cloudflare or AWS CloudFront (for static assets)

## Development Environment Setup

### Prerequisites

1. **Node.js & npm**

   ```bash
   # Check version (must be 18+)
   node --version
   npm --version
   ```

2. **PostgreSQL**

   ```bash
   # Install locally for development
   # macOS: brew install postgresql
   # Ubuntu: sudo apt-get install postgresql
   # Windows: Download from postgresql.org
   ```

3. **Git**

   ```bash
   # For version control
   git --version
   ```

4. **Code Editor** (Recommended)
   - VS Code with extensions:
     - ESLint
     - Prettier
     - PostgreSQL extension
     - REST Client (for API testing)

### Initial Project Setup

```bash
# 1. Create project directory
mkdir property-management
cd property-management

# 2. Initialize Node.js project
npm init -y

# 3. Install core dependencies
npm install express dotenv pg openai twilio resend

# 4. Install development dependencies
npm install --save-dev nodemon eslint prettier

# 5. Create project structure
mkdir -p src/{config,routes,controllers,services,models,middleware,utils}
mkdir -p tests/{unit,integration,e2e}
mkdir -p database/{migrations,seeds}
mkdir -p public

# 6. Initialize Git
git init
git add .
git commit -m "Initial commit"
```

### Environment Variables

Create `.env` file in project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost/property_manager_mvp
DB_HOST=localhost
DB_PORT=5432
DB_NAME=property_manager_mvp
DB_USER=postgres
DB_PASSWORD=your_password

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Resend
RESEND_API_KEY=re_your-resend-api-key-here
RESEND_FROM_EMAIL=noreply@yourdomain.com

# JWT Secret (for dashboard authentication)
JWT_SECRET=your-super-secret-jwt-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001
```

### Database Setup

```bash
# 1. Create database
psql -U postgres
CREATE DATABASE property_manager_mvp;
\q

# 2. Run migrations (to be created)
# npm run migrate

# 3. Seed sample data (optional)
# npm run seed
```

## Dependencies

### Production Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3",
    "openai": "^4.20.1",
    "twilio": "^4.19.3",
    "resend": "^5.1.1",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "joi": "^17.11.0"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "nodemon": "^3.0.2",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

## Technical Constraints

### API Rate Limits

- **OpenAI**:
  - GPT-3.5-turbo: 3,500 RPM (requests per minute), 90,000 TPM (tokens per minute)
  - GPT-4: 500 RPM, 30,000 TPM
  - Implement rate limiting to stay within limits

- **Twilio**:
  - SMS: 1 message per second per phone number
  - Implement queueing for bulk messages

- **Resend**:
  - Free tier: 3,000 emails/month
  - Paid tiers: Higher limits

### Token Limits

- **OpenAI Context Window**:
  - GPT-3.5-turbo: 16,385 tokens
  - GPT-4: 128,000 tokens
  - Truncate conversation history to stay within limits
  - Monitor token usage for cost control

### Message Size Limits

- **Twilio SMS**: 1,600 characters (will split if longer)
- **Resend Email**: No strict limit, but keep reasonable (<10MB)
- **Database TEXT fields**: No practical limit for PostgreSQL

## Development Workflow

### Running the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Create migration
npm run migrate:create migration_name

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# View migration status
npm run migrate:status
```

### Testing Strategy

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

## API Integration Details

### OpenAI API

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Request Format**:

```javascript
{
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are Alice, an AI property manager..." },
    { role: "user", content: "My sink is leaking" }
  ],
  temperature: 0.7,
  max_tokens: 500,
  response_format: { type: "json_object" } // For structured output
}
```

**Error Handling**:

- Rate limit errors (429): Implement exponential backoff
- Invalid requests (400): Validate inputs before sending
- Server errors (500): Retry with fallback response

### Twilio API

**SMS Sending**:

```javascript
client.messages.create({
  body: "Your message here",
  from: process.env.TWILIO_PHONE_NUMBER,
  to: "+1234567890",
});
```

**Webhook Verification**:

- Validate Twilio signature to prevent spoofing
- Use `express.urlencoded()` middleware to parse form data

### Resend API

**Email Sending**:

```javascript
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  to: "recipient@example.com",
  from: process.env.RESEND_FROM_EMAIL,
  subject: "Maintenance Request",
  text: "Your message here",
  html: "<p>Your message here</p>",
});
```

## Code Quality Standards

### JavaScript/Node.js

- **ESLint Configuration**: Airbnb style guide
- **Prettier Configuration**: 2 space indentation, single quotes
- **Code Style**:
  - Use async/await for asynchronous operations
  - Prefer const over let when possible
  - Use template literals for string interpolation
  - Implement proper error handling with try/catch
  - Add JSDoc comments for complex functions

### Database

- Use parameterized queries to prevent SQL injection
- Implement proper indexing on foreign keys and frequently queried columns
- Use transactions for multi-step operations
- Add appropriate constraints (NOT NULL, UNIQUE, FOREIGN KEY)

### API Design

- RESTful endpoints with clear naming conventions
- Consistent response format:
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null
  }
  ```
- Proper HTTP status codes:
  - 200: Success
  - 201: Created
  - 400: Bad Request
  - 401: Unauthorized
  - 404: Not Found
  - 500: Internal Server Error

## Monitoring & Logging

### Logging Strategy

- **Development**: Console logs with Morgan for HTTP requests
- **Production**: Structured logging with Winston or similar
- **Log Levels**: error, warn, info, debug

### Metrics to Track

- Response time (p50, p95, p99)
- Error rate by endpoint
- API call counts (OpenAI, Twilio, Resend)
- Database query performance
- Active conversations per minute
- Maintenance request creation rate

### Cost Monitoring

- OpenAI: Token usage per conversation, daily/monthly totals
- Twilio: SMS count, voice call duration
- Resend: Email count
- Database: Query count, connection pool usage

## Security Best Practices

### Environment Variables

- Never commit `.env` file to version control
- Use `.env.example` as template
- Rotate API keys regularly
- Use different keys for development and production

### Input Validation

- Validate all user inputs using Joi or similar
- Sanitize inputs to prevent XSS attacks
- Implement rate limiting on all public endpoints
- Use CORS to restrict cross-origin requests

### Data Protection

- Hash passwords with bcrypt (cost factor 10+)
- Encrypt sensitive data at rest (phone numbers, emails)
- Use HTTPS for all communications in production
- Implement proper session management with JWT

## Deployment Considerations

### Environment-Specific Configuration

- **Development**: Local PostgreSQL, test API keys
- **Staging**: Production-like environment, test data
- **Production**: Managed services, real API keys, monitoring

### CI/CD Pipeline (Future)

- Automated testing on pull requests
- Linting and formatting checks
- Deployment to staging on merge to main
- Manual approval for production deployment

### Backup Strategy

- Daily database backups
- Retain backups for 30 days
- Store backups in secure, offsite location
- Test restore procedures regularly

## Troubleshooting Guide

### Common Issues

**Database Connection Errors**:

- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

**OpenAI API Errors**:

- Verify API key is valid
- Check rate limits
- Monitor token usage

**Twilio Webhook Issues**:

- Verify webhook URL is publicly accessible
- Check Twilio signature validation
- Ensure ngrok is running in development

**Memory Leaks**:

- Monitor with Node.js profiler
- Check for unclosed database connections
- Review event listener cleanup

### Performance Issues

**Slow API Responses**:

- Add database indexes
- Implement caching for frequently accessed data
- Optimize N+1 queries
- Use connection pooling

**High Memory Usage**:

- Limit conversation history size
- Implement pagination for large datasets
- Monitor memory usage with tools like clinic.js
