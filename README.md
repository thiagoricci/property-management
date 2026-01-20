# AI Property Management System

An AI-powered property management platform that automates tenant communications, maintenance requests, and property operations through intelligent conversation handling.

## Features

- 24/7 AI assistant handling tenant inquiries via SMS, email, and WhatsApp
- Automated maintenance request creation and prioritization
- Emergency detection and immediate manager escalation
- Real-time conversation logging and analytics
- Property manager dashboard for oversight and manual intervention
- Multi-channel communication (SMS, email, voice)
- Intelligent priority classification (emergency, urgent, normal, low)
- Automated notification system for property managers

## Technology Stack

- **Backend**: Node.js with Express framework
- **AI/LLM**: OpenAI ChatGPT API (GPT-3.5-turbo/GPT-4)
- **Database**: PostgreSQL
- **Communication**: Twilio (SMS/Voice), Resend (Email)
- **Frontend**: React or Vue.js (to be decided)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenAI API key
- Twilio account
- Resend account

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your API keys and database credentials

5. Set up the database:

   ```bash
   psql -U postgres
   CREATE DATABASE property_manager_mvp;
   \q
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
property-management/
├── src/
│   ├── config/          # Configuration files (database, OpenAI, Twilio, Resend)
│   ├── routes/          # API route handlers
│   ├── controllers/     # Business logic controllers
│   ├── services/        # External service integrations (AI, notifications)
│   ├── models/          # Database models
│   ├── middleware/      # Express middleware
│   └── utils/          # Utility functions
├── tests/              # Test files
├── database/           # Database migrations and seeds
├── public/             # Static assets
└── server.js          # Application entry point
```

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

## License

ISC

## Status

**Phase**: Planning/Design Phase
**Target Launch**: Beta within 8-12 weeks
