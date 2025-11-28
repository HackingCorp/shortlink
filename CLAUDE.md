# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Next.js dev mode)
- `npm run build` - Build for production (copies Leaflet assets + runs Prisma generate)
- `npm run start` - Start production server with custom Node server (server.ts)
- `npm run start:dev` - Start dev server with nodemon hot reload
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed:plans` - Seed subscription plans to database

## Database Operations

- Database is PostgreSQL (via Prisma ORM)
- Always run `npm run db:generate` after schema changes
- Use `npm run db:migrate` for development migrations
- For production deployments: `npx prisma migrate deploy`

## Project Architecture

### Tech Stack
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with NextAuth.js authentication
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for rate limiting
- **Analytics**: Custom analytics with geo-location tracking
- **UI Components**: Radix UI, Tremor React for charts

### Key Structure
- `/app` - Next.js 15 app router structure
  - `(app)` - Authenticated dashboard pages (dashboard, links, analytics, team, settings)
  - `(auth)` - Authentication pages (login, register)
  - `(public)` - Public pages and link redirects
  - `/api` - API routes including v1 REST API
  - `/r/[shortCode]` and `/[shortCode]` - Link redirect handlers
- `/components` - Reusable UI components
- `/lib` - Core utilities (auth, prisma, analytics, pricing, email)
  - `/lib/s3p` - S3P (Smobilpay) payment integration
  - `/lib/enkap` - Enkap payment integration
  - `/lib/cron` - Background jobs (payment verification)
- `/prisma` - Database schema and migrations
- `/contexts` - React contexts (Workspace)
- `/server.ts` - Custom production server with payment verification cron job

### Authentication System
- NextAuth.js with custom credentials provider
- Role-based access: FREE, STANDARD, PRO, ENTERPRISE
- Team management for ENTERPRISE users
- API key authentication for REST API

### Database Schema
- Users with role-based plans and expiration dates
- Links with analytics tracking (clicks, geo-location, devices)
- Teams with member management and invitations
- API keys for programmatic access

### Rate Limiting
- Redis-based rate limiting system
- Configurable via environment variables
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### API Structure
- REST API at `/api/v1`
- Authentication required for most endpoints
- Supports both session and API key auth
- Comprehensive analytics endpoints

### Environment Configuration
Required environment variables:
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_URL` and `NEXTAUTH_SECRET` - Authentication
- `REDIS_URL` - Redis for rate limiting
- Rate limiting: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

### Docker Deployment
- Multi-stage Dockerfile with standalone output
- Docker Compose setup with PostgreSQL and Redis
- Production-ready with proper build optimization
- Leaflet assets are copied during build process

### Path Aliases
- `@/*` - Project root
- `@/lib/*` - Library utilities
- `@/components/*` - UI components
- `@/app/*` - App directory
- `@/prisma/*` - Prisma directory

### Payment Integration
- S3P (Smobilpay) for mobile wallet payments (MTN, Orange)
- Enkap as alternative payment provider
- Payment verification cron job runs every 5 min (production) / 10 min (development)
- Disable with `DISABLE_PAYMENT_VERIFICATION=true`

### Special Features
- QR code generation for short links
- Geographic analytics with Leaflet maps (geoip-lite)
- Real-time updates via WebSocket (socket.io)
- Custom slug generation with configurable length (SystemConfig table)
- GDPR-compliant IP anonymization