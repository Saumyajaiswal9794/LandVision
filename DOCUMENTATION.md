# LandVision — Complete Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-11-02  
**Status:** Production-Ready  

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Authentication & Authorization](#authentication--authorization)
- [Data Models](#data-models)
- [API Documentation](#api-documentation)
- [Frontend Routes](#frontend-routes)
- [Extraction Pipeline](#extraction-pipeline)
- [Validation System](#validation-system)
- [Review Workflow](#review-workflow)
- [GIS & Mapping](#gis--mapping)
- [Background Jobs & Queues](#background-jobs--queues)
- [Admin Panel](#admin-panel)
- [Notifications System](#notifications-system)
- [Audit Logging](#audit-logging)
- [Security](#security)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)



## Overview

LandVision is an AI-powered platform for digitizing Indian land ownership records (Khasra/Khatauni registers). It transforms scanned, often handwritten land records into structured, searchable, geospatially-indexed digital records through an automated pipeline with human-in-the-loop review.

### Key Capabilities
- **AI-Powered Extraction**: Uses Google Gemini 2.5 Flash for multimodal extraction from scanned documents
- **Multi-row Support**: Extracts multiple plot records from a single page
- **Intelligent Validation**: Automatic duplicate detection, area-sum validation, and confidence-based routing
- **Human Review Workflow**: Side-by-side document viewer with field editing capabilities
- **GIS Integration**: PostGIS-powered mapping with Leaflet for spatial visualization
- **Role-Based Access Control**: Officer, Reviewer, and Admin roles with granular permissions
- **Production-Ready Security**: JWT authentication, RLS policies, rate limiting, audit logging

## Architecture

LandVision follows a four-tier architecture:

`
Frontend (Next.js 14) --HTTPS--> Backend (Express + Node.js) --Queries--> Databases/Services
                                                                          +-- MongoDB (Document Storage)
                                                                          +-- PostgreSQL + PostGIS (Spatial Data)
                                                                          +-- Supabase (Auth + Storage)
                                                                          +-- Google Gemini API (AI Extraction)
`

### Request Flow
1. **Upload**: Officer uploads scanned document to Supabase Storage via backend
2. **Extraction**: AI extracts fields using Gemini with Tesseract fallback
3. **Validation**: Rules engine checks for duplicates, area limits, confidence thresholds
4. **Review**: Low-confidence records routed to reviewers for manual verification
5. **GIS**: Approved records linked to spatial polygons for mapping



## Tech Stack

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React framework with App Router | 14.2.3 |
| React | UI library | 18.2.0 |
| TypeScript | Type safety | 5.4.5 |
| Tailwind CSS | Styling | 3.4.3 |
| Leaflet | Interactive maps | 1.9.4 |
| React Leaflet | React bindings for Leaflet | 4.2.1 |
| Supabase JS | Auth client | 2.39.8 |

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | - |
| Express | Web framework | 4.19.2 |
| TypeScript | Type safety | 5.3.3 |
| Mongoose | MongoDB ODM | 8.2.1 |
| pg | PostgreSQL client | 8.11.3 |
| BullMQ | Job queue | 6.3.18 |
| Supabase JS | Auth verification | 2.39.8 |
| Google GenAI | Gemini API client | 2.19.0 |
| Tesseract.js | OCR fallback | 4.1.1 |
| Helmet | Security headers | 8.3.0 |
| express-rate-limit | Rate limiting | 8.7.2 |
| Pino | Logging | 10.4.0 |

### Databases & Services
| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Primary document store for LandRecords, Users, etc. |
| PostgreSQL + PostGIS | Spatial data for plot boundaries |
| Supabase | Authentication, file storage, optional RLS |
| Google Gemini 2.5 Flash | AI extraction |
| Redis (optional) | Background job processing with BullMQ |



## Project Structure

`
LandVision/
+-- client/                    # Next.js frontend
¦   +-- app/                  # App Router pages
¦   ¦   +-- admin/           # Admin panel pages
¦   ¦   +-- auth/            # Auth callback
¦   ¦   +-- dashboard/       # Main dashboard
¦   ¦   +-- login/           # Login page
¦   ¦   +-- map/             # GIS map viewer
¦   ¦   +-- review/          # Review interface
¦   ¦   +-- upload/          # Document upload
¦   +-- components/          # React components
¦   +-- lib/                 # Utilities (api, supabase client)
¦   +-- package.json
+-- server/                   # Express backend
¦   +-- src/
¦   ¦   +-- config/         # DB, env, supabase config
¦   ¦   +-- controllers/    # Route handlers
¦   ¦   +-- db/             # Migrations
¦   ¦   +-- middleware/     # Auth, RBAC, rate limiting, etc.
¦   ¦   +-- models/         # Mongoose models
¦   ¦   +-- queues/         # BullMQ queues
¦   ¦   +-- routes/         # Express routes
¦   ¦   +-- services/       # Business logic (extraction, validation)
¦   ¦   +-- types/          # TypeScript types
¦   ¦   +-- index.ts        # Entry point
¦   +-- package.json
+-- packages/
¦   +-- types/              # Shared TypeScript types
+-- docs/                   # Additional documentation



## Features

### Core Features

#### Document Management
- **Upload**: Support for PDF and image files (JPG, PNG, TIFF) up to 10MB
- **Multi-page/Multi-row**: Extract multiple plot records from single document
- **Status Tracking**: uploaded ? extracting ? extracted/needs_review ? reviewed_approved/reviewed_rejected
- **Storage Integration**: Secure file storage in Supabase Storage with signed URLs

#### AI Extraction
- **Gemini 2.5 Flash**: Primary extraction engine with structured JSON output
- **Per-field Confidence**: Each extracted field has confidence score (0-1) and source
- **Bounding Boxes**: Spatial coordinates for field locations on document
- **Tesseract Fallback**: Automatic fallback on Gemini rate limits or failures
- **Multi-row Extraction**: Identifies and extracts multiple plots from same page
- **Source Tracking**: Records whether extraction came from 'gemini' or 'tesseract'

#### Validation
- **Duplicate Detection**: Cross-document and within-document duplicate checking
- **Khasra Matching**: Case-insensitive matching with sub-survey number support
- **Village Matching**: Case-insensitive village name comparison
- **Area Sum Validation**: Warns if village total area exceeds configured limit
- **Confidence Routing**: Auto-approve if all fields above threshold, else route to review
- **Structured Validation Results**: Each flag has rule, severity (error/warning/info), message, field

#### Review Workflow
- **Side-by-side Viewer**: Document image/PDF alongside extracted fields
- **Field Editing**: Edit any extracted field with human correction tracking
- **Source Marking**: Human-corrected fields marked as source: human_corrected
- **Batch Actions**: Approve all high-confidence fields
- **Review Notes**: Add comments/reasons for approval/rejection
- **Role-based Access**: Only reviewers and admins can review

#### GIS & Mapping
- **PostGIS Integration**: Spatial queries for plot boundaries
- **Interactive Map**: Leaflet-based map with polygon rendering
- **Status Coloring**: Color-coded polygons by record status
- **Village Filtering**: View all plots in a selected village
- **Popup Navigation**: Click polygon to view full record details
- **Auto-linking**: Approved records link to spatial data via khasra+village

### New Production Features (Added)

#### Authentication & User Management
- **MongoDB User Sync**: Users persisted in MongoDB on first login
- **Role Management**: Admin panel to assign officer/reviewer/admin roles
- **DB-backed Roles**: Roles fetched from MongoDB with fallback to Supabase metadata
- **Google OAuth**: Support for Google sign-in
- **Gated Dev Bypass**: Dev auth bypass only when explicitly enabled via env var

#### Security
- **Helmet.js**: Security headers (XSS, clickjacking, MIME sniffing protection)
- **Rate Limiting**: Per-route limits (upload: 10/hour, extract: 20/hour, login: 5/15min, API: 100/min)
- **CORS Hardening**: Strict origin validation
- **RLS Policies**: Supabase Row Level Security migration included
- **Input Validation**: Request validation throughout

#### Admin Panel
- **User Management**: View all users, update roles
- **Audit Logs**: View all system actions with timestamps, IPs, user info
- **API Usage Tracking**: Monitor Gemini API calls, tokens, costs
- **Review Queue Management**: View and manage review queue

#### Notifications
- **In-app Notifications**: Bell icon with notification list
- **Event Triggers**: Notifications for review requests, extraction complete/failed, review actions
- **Read/Unread Status**: Mark individual or all as read

#### Audit & Monitoring
- **Audit Trail**: Logs all mutations (POST/PUT/PATCH/DELETE) with user, action, resource, IP
- **API Cost Tracking**: Tracks Gemini API usage with token counts and cost estimates
- **Health Checks**: /health and /ready endpoints for monitoring



## Authentication & Authorization

### Authentication Flow

1. **Supabase Auth**: Users authenticate via Supabase (email/password or Google OAuth)
2. **Token Verification**: Backend verifies JWT tokens using Supabase Admin client
3. **User Sync**: On first auth, user created/fetched from MongoDB with role
4. **Request Context**: User object attached to eq.user with id, email, role

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **officer** | Upload documents, trigger extraction, view own documents, access dashboard |
| **reviewer** | All officer permissions + review documents, approve/reject, access review queue |
| **admin** | All permissions + user management, audit logs, API usage, system configuration |

### Middleware

- **equireAuth**: Verifies JWT token, syncs user to MongoDB, attaches user to request
- **equireRole(roles)**: Checks if user has required role
- **uploadRateLimiter**: Limits uploads to 10 per hour
- **extractRateLimiter**: Limits extractions to 20 per hour
- **loginRateLimiter**: Limits login attempts to 5 per 15 minutes
- **piRateLimiter**: General API limit of 100 requests per minute

### Dev Auth Bypass
For local development without Supabase setup:
`env
NODE_ENV=development
ALLOW_DEV_AUTH_BYPASS=true
`
When enabled, injects a default officer user. **Must be disabled in production.**



## Data Models

### MongoDB Models (server/src/models/)

#### User
`	ypescript
{
  supabaseId: string (unique, indexed)
  email: string (indexed)
  role: 'officer' | 'reviewer' | 'admin'
  name?: string
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}
`

#### LandRecord
Core model for documents and extracted records.
`	ypescript
{
  // Upload metadata
  filename, uploadedBy, storagePath, storageUrl
  
  // Record identifiers
  documentId, khataNumber, khasraNumber, khatoniNumber
  village (required, indexed), district, tehsil, state
  
  // Owners
  owners: string[], coOwners: [{name, share}]
  
  // Area
  areaTotal, areaUnit: 'HECTARE'|'ACRE'|'BIGHA'|'KILLA'|'MARLA'
  
  // Extraction
  extractedFields: {
    ownerName, khasraNumber, plotArea, village, district, landClass,
    khataNumber, tehsil, subSurveyNumber, fatherOrHusbandName, remarks
  } // Each is ExtractedField with value, confidence, source, bbox
  extractionSource: 'gemini'|'tesseract'
  extractionError?: string
  
  // Validation
  validationFlags: string[] (legacy)
  validationResults: [{rule, severity, message, field}]
  lowConfidenceFields: string[]
  
  // Review
  status: 'uploaded'|'extracting'|'extracted'|'extraction_failed'|
          'needs_review'|'auto_approved'|'reviewed_approved'|'reviewed_rejected'
  reviewedBy?, reviewedAt?
  
  // Multi-row support
  documentId (parent), rowIndex, pageNo, subSurveyNumber
  
  // GIS
  gisPlotId?
  
  timestamps: true
}
`

#### ReviewQueue
`	ypescript
{
  landRecordId: string (indexed)
  priority: 'low'|'medium'|'high'
  status: 'pending'|'assigned'|'completed' (indexed)
  assignedTo?: string
  reason?: string
  timestamps: true
}
`

#### AuditLog
`	ypescript
{
  userId: string (indexed)
  userEmail?: string
  action: string (indexed)
  resourceType: string (indexed)
  resourceId?: string
  ip?: string
  userAgent?: string
  metadata?: any
  timestamp: Date (indexed)
}
`

#### ApiUsage
`	ypescript
{
  userId?: string
  documentId?: string
  modelName: string
  promptTokens?, completionTokens?, totalTokens?
  cost?
  operation: string
  timestamp: Date
}
`

#### Notification
`	ypescript
{
  userId: string (indexed)
  type: 'review_requested'|'review_completed'|'extraction_failed'|'extraction_complete'
  title: string
  message: string
  read: boolean (indexed)
  metadata?: any
  timestamps: true
}
`

#### ExtractionJob
`	ypescript
{
  recordId: string (indexed)
  status: 'pending'|'processing'|'completed'|'failed' (indexed)
  attempts: number
  error?: string
  result?: any
  timestamps: true
}
`

### PostgreSQL + PostGIS
Used for spatial data (plots table with geometry). Schema managed separately.



## API Documentation

Base URL: http://localhost:4000 (dev) or deployed URL

### Authentication
All protected routes require Authorization: Bearer <supabase-jwt-token> header.

### Documents API (/api/documents)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | /upload | Required | officer+ | Upload document (multipart/form-data, field: file) |
| GET | / | Required | all | List documents (role-filtered) |
| GET | /:id | Required | all | Get document detail with rows |
| GET | /:id/status | Required | all | Get document status |
| GET | /:id/extraction-status | Required | all | Get extraction status (alias) |
| POST | /:id/extract | Required | officer+ | Trigger extraction (returns 202 Accepted) |
| PATCH | /:id/review | Required | reviewer+ | Review document (approve/reject/edit) |

### Auth API (/api/auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /profile or /me | Required | Get current user profile |
| POST | /sync | Required | Sync user from Supabase to MongoDB |

### Records API (/api/records)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | / | Required | all | List records |
| GET | /:id | Required | all | Get record by ID |
| PATCH | /:id | Required | officer+ | Update record field |

### GIS API (/api/gis)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /plots | Required | Get plots (filter by village) |
| GET | /plots/:id | Required | Get plot by ID |

### Review Queue API (/api/review-queue)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | / | Required | reviewer+ | Get review queue |
| POST | /:id/assign | Required | reviewer+ | Assign queue item to self |
| POST | /:id/complete | Required | reviewer+ | Mark queue item complete |

### Admin API (/api/admin)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /users | Required | admin | List all users |
| GET | /users/:id | Required | admin | Get user by ID |
| PUT | /users/:id/role | Required | admin | Update user role |
| GET | /audit | Required | admin | Get audit logs |
| GET | /usage | Required | admin | Get API usage and costs |

### Notifications API (/api/notifications)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | Required | Get user notifications |
| PATCH | /:id/read | Required | Mark notification as read |
| POST | /read-all | Required | Mark all notifications as read |

### Audit API (/api/audit)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | / | Required | admin | Get audit logs (alias) |

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | None | Basic health check |
| GET | /ready | None | Readiness check (DB connections) |



## Frontend Routes

| Route | Description | Access |
|-------|-------------|--------|
| / | Home/redirect | Public |
| /login | Login page (email/password, Google OAuth) | Public |
| /auth/callback | OAuth callback handler | Public |
| /signup | Sign up page | Public |
| /dashboard | Main dashboard with document list | Authenticated |
| /upload | Document upload page | Officer+ |
| /review/[id] | Document review page (side-by-side viewer) | Reviewer+ |
| /map | GIS map viewer | Authenticated |
| /admin | Admin panel home | Admin |
| /admin/users | User management | Admin |
| /admin/audit | Audit logs | Admin |
| /admin/usage | API usage tracking | Admin |

## Extraction Pipeline

### Flow
1. **Trigger**: POST /api/documents/:id/extract called
2. **Status Update**: Record status set to extracting, job added to queue
3. **Download**: File downloaded from Supabase Storage (with URL refresh retry)
4. **Extraction**: Gemini API called with structured prompt
5. **Fallback**: If Gemini fails/rate-limited, use Tesseract OCR
6. **Parsing**: Multi-row extraction - one record per plot
7. **Persistence**: Create child LandRecord for each row with documentId link
8. **Validation**: Run duplicate detection and area checks
9. **Routing**: Auto-approve or route to needs_review based on confidence
10. **Queue Update**: Add to review queue if needs_review

### Gemini Configuration
- Model: gemini-2.5-flash
- Structured output with JSON schema
- Per-field confidence scoring
- Bounding box extraction
- Retry logic with exponential backoff
- Respects GeminiRateLimitError and GeminiError

### Extraction Schema
`	ypescript
{
  rows: [{
    ownerName: { value, confidence, source, bbox },
    khasraNumber: { value, confidence, source, bbox },
    plotArea: { value, confidence, source, bbox },
    village: { value, confidence, source, bbox },
    district: { value, confidence, source, bbox },
    landClass: { value, confidence, source, bbox },
    khataNumber: { value, confidence, source, bbox },
    tehsil: { value, confidence, source, bbox },
    subSurveyNumber: { value, confidence, source, bbox },
    fatherOrHusbandName: { value, confidence, source, bbox },
    remarks: { value, confidence, source, bbox }
  }],
  extractionSource: 'gemini' | 'tesseract'
}
`



## Validation System

### Duplicate Detection
Located in server/src/services/validation/duplicateDetection.ts

**Checks:**
- **Cross-document duplicates**: Same khasra+village across different documents
- **Within-document duplicates**: Same khasra+village within same document
- **Sub-survey handling**: Considers subSurveyNumber for more precise matching
- **Case-insensitive**: Village and khasra matching is case-insensitive
- **Self-exclusion**: Excludes current record being validated

**Flags:**
- duplicate_detected: Duplicate found elsewhere
- duplicate_within_document: Duplicate within same document

### Area Sum Validation
**Checks:**
- Sums all plot areas for a village
- Compares against VILLAGE_AREA_LIMIT_HECTARES (default: 500)
- Flags if exceeds limit

**Flags:**
- exceeds_village_total: Village total area exceeds limit

### Confidence Routing
Located in server/src/services/validation/confidenceRouter.ts

**Logic:**
- Calculates combined confidence across all extracted fields
- If below CONFIDENCE_THRESHOLD (default: 0.75) ? status 
eeds_review
- If all fields meet threshold ? status uto_approved
- Collects lowConfidenceFields list
- Considers validation flags in routing decision

**Environment Variable:** CONFIDENCE_THRESHOLD (default: 0.75)



## Review Workflow

### States
1. **uploaded** - Document uploaded, not yet extracted
2. **extracting** - Extraction in progress
3. **extracted** - Extraction complete, auto-approved (all high confidence)
4. **extraction_failed** - Extraction failed
5. **needs_review** - Requires human review (low confidence or validation issues)
6. **auto_approved** - Auto-approved by system
7. **reviewed_approved** - Approved by reviewer
8. **reviewed_rejected** - Rejected by reviewer

### Review Process
1. Reviewer accesses document from dashboard or review queue
2. Side-by-side view shows original document and extracted fields
3. Reviewer can:
   - Edit any field (marks as human_corrected, confidence 1.0)
   - Approve all high-confidence fields
   - Approve document as-is
   - Reject with reason
4. On approval: Status becomes eviewed_approved, record linked to GIS if possible
5. On rejection: Status becomes eviewed_rejected
6. Review metadata stored (reviewedBy, reviewedAt)

### Review Queue
- Auto-populated when document needs review
- Prioritized (high/medium/low)
- Can be assigned to specific reviewer
- Tracks pending/assigned/completed status



## GIS & Mapping

### Technology
- **PostgreSQL + PostGIS**: Spatial database for plot geometries
- **Leaflet**: Interactive mapping library
- **React Leaflet**: React components for Leaflet

### Features
- Village-based filtering
- Color-coded polygons by status
- Popup with plot details
- Click to navigate to document
- Auto-centering on village

### Data Flow
1. Approved records have khasraNumber and illage
2. Plots stored in PostGIS with geometry and metadata
3. API queries plots by village
4. Frontend renders as GeoJSON/Leaflet polygons
5. Polygons colored based on record status

### Status Colors (typical)
- approved/auto_approved: Green
- needs_review: Yellow/Orange
- rejected: Red
- others: Gray



## Background Jobs & Queues

### BullMQ Setup
- Uses Redis if REDIS_URL is configured
- Falls back to in-memory queue for local development
- Queue name: extraction
- Concurrency: 2 workers

### Extraction Queue
`	ypescript
extractionQueue.addJob({ id: recordId })
`

### Worker Behavior
- Processes extraction jobs asynchronously
- Updates record status throughout
- Retries on failure (up to 3 attempts with exponential backoff)
- Respects Gemini rate limits
- Logs job success/failure

### Job Status Tracking
- ExtractionJob model tracks job state
- Attempts counter for retries
- Error messages stored on failure
- Results stored on completion



## Admin Panel

Accessible at /admin for users with dmin role.

### Features

#### User Management (/admin/users)
- View all users with email, role, created date
- Update user roles (officer/reviewer/admin)
- Real-time updates

#### Audit Logs (/admin/audit)
- View all system mutations
- Filterable by action, resource type, user
- Shows timestamp, user, action, resource, IP, user agent
- Paginated (default 100 entries)

#### API Usage (/admin/usage)
- Track Gemini API calls
- Monitor token usage (prompt/completion/total)
- Cost estimates per call
- Total cost summary
- Model and operation tracking

### API Endpoints
All under /api/admin with equireAuth and equireRole(['admin'])



## Notifications System

### Types
- eview_requested - Document needs review
- eview_completed - Review action completed
- extraction_failed - Extraction failed
- extraction_complete - Extraction completed

### Features
- In-app notification bell
- Unread count
- Mark individual as read
- Mark all as read
- Sorted by newest first
- Metadata support for context

### API
- GET /api/notifications - Get user notifications
- PATCH /api/notifications/:id/read - Mark as read
- POST /api/notifications/read-all - Mark all as read



## Audit Logging

### What Gets Logged
All mutation operations (POST, PUT, PATCH, DELETE) via audit middleware:
- User ID and email
- Action type
- Resource type and ID
- HTTP method and path
- IP address
- User agent
- Status code
- Timestamp

### Storage
- MongoDB AuditLog collection
- Indexed by userId, action, resourceType, timestamp

### Access
- Admin only via /admin/audit or /api/audit

### Implementation
server/src/middleware/auditLogger.ts - Middleware to log mutations



## Security

### Implemented Measures

#### Authentication
- Supabase JWT token verification
- Token-based auth for all protected routes
- Session management via Supabase
- User sync to MongoDB

#### Authorization
- Role-based access control (RBAC)
- Route-level protection with equireRole
- Resource-level checks (e.g., officers can only extract own documents)

#### API Security
- **Helmet.js**: Sets security headers
- **Rate Limiting**: Prevents abuse on sensitive endpoints
- **CORS**: Strict origin validation
- **Input Sanitization**: Type checking and validation

#### Data Security
- **RLS Policies**: Supabase Row Level Security (migration included)
- **Service Role**: Separate key for server operations
- **Signed URLs**: Time-limited URLs for file access
- **Environment Variables**: Secrets never committed

#### Audit & Monitoring
- Comprehensive audit logging
- Error tracking without leaking stack traces in production
- Health check endpoints

### Security Checklist
- [x] No auth bypass in production
- [x] JWT verification on protected routes
- [x] Role enforcement
- [x] Rate limiting
- [x] Security headers
- [x] CORS configured
- [x] Secrets in environment variables
- [x] Audit logging for mutations
- [x] RLS policies defined

## Environment Configuration

### Server Environment Variables (server/.env)

`env
# Runtime
NODE_ENV=development
PORT=4000

# CORS
CLIENT_ORIGIN=http://localhost:3000

# Databases
MONGODB_URI=mongodb://localhost:27017/landvision
PG_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/landvision

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI
GEMINI_API_KEY=your-gemini-api-key

# Validation
CONFIDENCE_THRESHOLD=0.75
VILLAGE_AREA_LIMIT_HECTARES=500

# Auth
ALLOW_DEV_AUTH_BYPASS=false

# Queue (optional)
REDIS_URL=
`

### Client Environment Variables (client/.env.local)

`env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
`

### Production Notes
- All required vars must be set (server throws fatal error if missing)
- ALLOW_DEV_AUTH_BYPASS must be false/unset
- Use strong secrets
- Configure proper CORS origins



## Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MongoDB (local or Atlas)
- PostgreSQL with PostGIS (local or cloud)
- Redis (optional, for queue)
- Supabase account
- Google Gemini API key

### Setup

1. **Clone repository**
`ash
git clone <repo-url>
cd LandVision
`

2. **Install dependencies**
`ash
npm install
`

3. **Configure environment**
`ash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
# Edit with your credentials
`

4. **Start databases (optional with Docker)**
`ash
docker-compose up -d
`

5. **Run development servers**
`ash
npm run dev
`
This starts both client (http://localhost:3000) and server (http://localhost:4000)

### Individual Commands
`ash
# Server only
cd server && npm run dev

# Client only
cd client && npm run dev

# Build
npm run build

# Type check
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
`

### Seeding Demo Data
`ash
cd server
npm run seed:demo
npm run seed:plots
`

### Dev Auth Bypass
For testing without Supabase:
1. Set ALLOW_DEV_AUTH_BYPASS=true in server/.env
2. Server will inject default officer user
3. **Never use in production**



## Deployment

### Backend (Render)
Uses ender.yaml blueprint:
1. Connect repo to Render
2. Apply blueprint
3. Set environment variables in dashboard
4. Deploy

Key settings:
- Root directory: server
- Build command: 
pm install && npm run build
- Start command: 
pm start
- Health check: /health

### Frontend (Vercel)
Uses ercel.json:
1. Import repo to Vercel
2. Set root directory to client
3. Set environment variables
4. Deploy

### Environment Variables for Production
See server/.env.production.example for full list.

### Database Migrations
SQL migrations in server/src/db/migrations/:
- Run via Supabase SQL editor or migration script
-  02_enable_rls_policies.sql enables RLS

### Post-Deployment Checklist
- [ ] Health check passes
- [ ] All env vars configured
- [ ] CORS allows frontend domain
- [ ] Supabase auth configured with redirect URLs
- [ ] Database connections working
- [ ] File upload working
- [ ] AI extraction working
- [ ] GIS maps loading



## Testing

### Test Framework
- **Vitest** for unit and integration tests
- Tests located in __tests__ directories

### Running Tests
`ash
cd server
npm test
`

### Test Coverage
Current tests include:
- RBAC middleware tests
- Records controller tests
- Basic auth tests

### Manual Testing
Follow DEMO_SCRIPT.md for end-to-end testing flow.

## Monitoring & Observability

### Logging
- **Pino** for structured logging
- Pretty printing in development
- JSON logs in production
- Sensitive data redacted (auth headers, cookies)

### Health Checks
- GET /health - Basic uptime check
- GET /ready - Checks MongoDB and PostgreSQL connectivity

### Metrics to Monitor
- API response times
- Extraction success/failure rates
- Gemini API usage and costs
- Queue depth
- Error rates
- Database connection status

### Recommended Tools
- Sentry for error tracking
- Log aggregation (e.g., Logtail, Datadog)
- Uptime monitoring

## Troubleshooting

### Common Issues

#### Server won't start
- Check all required env vars are set
- Verify database connections
- Check MongoDB/PostgreSQL are running

#### Extraction fails
- Verify Gemini API key is valid
- Check API quota/rate limits
- Ensure file is accessible from Supabase Storage
- Check file format (PDF/image supported)

#### Auth issues
- Verify Supabase credentials
- Check redirect URLs in Supabase dashboard
- Ensure JWT tokens are passed correctly
- In dev, consider enabling ALLOW_DEV_AUTH_BYPASS

#### CORS errors
- Check CLIENT_ORIGIN matches frontend URL
- Ensure credentials are enabled
- Verify CORS configuration

#### Database connection errors
- Check connection strings
- Verify network access/firewall rules
- For Postgres, ensure PostGIS extension is enabled

### Debug Mode
Set NODE_ENV=development for verbose logging.

## Contributing

### Code Style
- TypeScript strict mode
- ESLint configuration
- Follow existing patterns
- Add types for all new code

### Git Workflow
1. Create feature branch
2. Make changes
3. Run type check and tests
4. Commit with descriptive messages
5. Create pull request

### Adding New Features
1. Update types in packages/types if shared
2. Add models in server/src/models
3. Add controllers and routes
4. Update frontend
5. Add tests
6. Update documentation

