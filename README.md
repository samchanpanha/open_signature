# OpenSignature

A full-featured digital signature platform built with Next.js, Prisma, and PostgreSQL. Upload PDFs, place form fields, send for signing, and manage documents with role-based access control.

## Features

- **PDF Upload & Field Placement** - Drag-and-drop PDF upload with interactive field placement (signature, date, text, dropdown, checkbox)
- **Multi-Signer Support** - Assign fields to multiple signers with color-coded tracking
- **Signing Workflow** - Send documents for sequential or parallel signing with OTP verification
- **Organization Management** - Multi-tenant organizations with role-based permissions (owner, admin, editor, signer, viewer)
- **Templates** - Save and reuse field configurations as templates
- **Folders** - Organize documents into folders within organizations
- **Audit Trail** - Complete audit log for every document action
- **Document Versioning** - Track document versions and compare changes
- **Reminders** - Set automated reminders for pending signatures
- **Webhooks** - Configurable webhooks for document events
- **API Keys** - Programmatic access with scoped API keys
- **Email Templates** - Customizable email notifications
- **Branding** - Custom logos and brand colors per organization
- **Workflows** - Configurable signing order workflows
- **Contacts** - Contact management with groups
- **Dark Mode** - Full dark mode support
- **Keyboard Shortcuts** - Press `?` to view available shortcuts
- **Bulk Operations** - Bulk send, move, and delete documents
- **Form Data Export** - Export filled form data as CSV
- **Public Forms** - Shareable form templates via public links
- **Telegram Integration** - Bot notifications for document events

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, Zustand, Framer Motion
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **PDF Processing**: pdf-lib, pdf.js
- **Auth**: JWT with bcrypt password hashing, OTP verification
- **Other**: Redis (optional), Nodemailer, ExcelJS, docx

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

1. Clone and install:
```bash
git clone <repository-url>
cd open-signature
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT_SECRET
```

3. Initialize database:
```bash
npx prisma db push
npx prisma generate
```

4. Start development server:
```bash
npx next dev -p 3000
```

5. Open http://localhost:3000 and register an account.

### Seed Data

```bash
npx prisma db seed
```

Seed credentials: `admin@opesign.com` / `Admin123!`

## Development

### Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # Authentication (login, register, me)
│   │   ├── documents/          # Document CRUD, send, download, audit
│   │   ├── sign/               # Public signing endpoints
│   │   ├── organizations/      # Org management, members, permissions
│   │   ├── templates/          # Document templates
│   │   ├── contacts/           # Contact management
│   │   ├── webhooks/           # Webhook management
│   │   ├── workflows/          # Signing workflows
│   │   └── ...                 # Other API routes
│   ├── admin/                  # Admin pages
│   ├── share/                  # Public share pages
│   └── setup-password/         # Password setup flow
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── permissions/            # Permission management components
│   ├── workflows/              # Workflow components
│   ├── contacts/               # Contact components
│   └── ...                     # Feature components
├── lib/
│   ├── api.ts                  # API client functions
│   ├── auth.ts                 # Server-side auth helpers
│   ├── db.ts                   # Prisma client
│   ├── store.ts                # Zustand state management
│   ├── validation.ts           # Zod schemas
│   └── ...                     # Utility modules
└── prisma/
    └── schema.prisma           # Database schema
```

### Available Scripts

```bash
# Development
npx next dev -p 3000          # Start dev server
npx next dev -p 3001          # Start on alternate port

# Build
npx next build                # Production build
npx next start                # Start production server

# Database
npx prisma db push            # Push schema to database
npx prisma db seed            # Seed database
npx prisma db reset           # Reset database
npx prisma migrate dev        # Create migration

# Type Checking
npx tsc --noEmit              # TypeScript check
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...  # PostgreSQL connection string
JWT_SECRET=your-secret-key     # JWT signing key (min 32 chars)

# Optional
REDIS_URL=redis://...          # Redis for rate limiting
EMAIL_HOST=smtp.example.com    # SMTP for email notifications
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM=noreply@example.com
CRON_SECRET=secret             # For /api/reminders/process cron endpoint
```

## API Documentation

### Authentication

```bash
# Register
POST /api/auth/register
{ "email": "...", "password": "...", "name": "..." }

# Login
POST /api/auth/login
{ "email": "...", "password": "..." }

# Get current user
GET /api/auth/me
Authorization: Bearer <token>
```

### Documents

```bash
# List documents
GET /api/documents?orgId=...&signerEmail=...&folderId=...

# Upload document
POST /api/documents
FormData: file, title, organizationId

# Get document detail
GET /api/documents/:id

# Send for signing
POST /api/documents/:id/send
{ "signers": [...], "fieldAssignments": [...], "ccRecipients": [...], "expiresAt": "...", "workflowId": "..." }

# Download filled PDF
GET /api/documents/:id/download

# Get audit log
GET /api/documents/:id/audit
```

### Signing

```bash
# Get signing info
GET /api/sign/:token

# Complete signing
POST /api/sign/:token/complete
{ "fieldValues": { "fieldId": "value" }, "signatureImage": "data:image/png;..." }

# Reject signing
POST /api/sign/:token/reject
{ "reason": "..." }
```

### Organizations

```bash
# List organizations
GET /api/organizations

# Create organization
POST /api/organizations
{ "name": "..." }

# List members
GET /api/organizations/:id/members

# Invite member
POST /api/organizations/:id/members
{ "email": "...", "role": "member" }
```

## Deployment

### Docker

```bash
docker-compose up -d
```

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Production Build

```bash
npx next build
NODE_ENV=production npx next start
```

## License

MIT
