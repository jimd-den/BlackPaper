# Black Paper - Academic Discourse Platform

## Overview

Black Paper is a decentralized academic discourse platform built on the Nostr protocol. It enables researchers and academics to propose hypotheses, submit evidence sources, and engage in peer review discussions. The platform implements Domain-Driven Design principles with clean architecture patterns, featuring a React frontend, Express backend, and PostgreSQL database with Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Styling**: TailwindCSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React Context for global state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **API Design**: RESTful endpoints with /api prefix
- **Error Handling**: Centralized error middleware
- **Request Logging**: Custom middleware for API request tracking

### Database Layer
- **Database**: PostgreSQL (configured but not yet implemented)
- **ORM**: Drizzle ORM with migrations support
- **Schema**: Located in shared/schema.ts for cross-layer access
- **Connection**: Neon Database serverless driver

## Key Components

### Domain Layer
The application follows Domain-Driven Design with rich domain models:

- **Hypothesis Aggregate**: Core entity representing testable academic propositions
- **Source Value Objects**: Academic sources with credibility scoring and stance classification
- **Comment Entities**: Threaded discussion system with quality metrics
- **User Identity**: Nostr-based cryptographic identity management

### Nostr Protocol Integration
- **Decentralized Identity**: Users identified by cryptographic keypairs
- **Event Types**: Custom event kinds for hypotheses, sources, votes, and reports
- **Relay Network**: Multi-relay configuration for redundancy
- **Client Implementation**: Custom Nostr client with connection pooling

### UI Component System
- **Design System**: Academic-focused color palette with supporting/refuting evidence colors
- **Responsive Design**: Mobile-first approach with breakpoint-based layouts
- **Accessibility**: Radix UI primitives ensure ARIA compliance
- **Modal System**: Complex modal workflows for hypothesis creation and source addition

## Data Flow

### Hypothesis Lifecycle
1. User creates hypothesis through form validation
2. Hypothesis published as Nostr event to relay network
3. Community adds supporting/refuting sources
4. Evidence evaluated through community voting
5. Threaded discussions provide peer review

### Evidence Evaluation
1. Sources submitted with URL validation and credibility assessment
2. Community votes on source quality and relevance
3. Evidence balance calculated from voting patterns
4. Controversial hypotheses flagged for additional review

### User Authentication
1. Cryptographic keypair generation or import
2. Nostr relay connection establishment
3. Event signing for content publication
4. Decentralized identity without central authority

## External Dependencies

### Core Libraries
- **Nostr Protocol**: nostr-tools for cryptographic operations and relay communication
- **Database**: @neondatabase/serverless for PostgreSQL connection
- **UI Framework**: Comprehensive Radix UI component library
- **Form Validation**: React Hook Form with Zod schema validation
- **Date Handling**: date-fns for timestamp formatting

### Development Tools
- **Build System**: Vite for frontend bundling with hot reload
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESLint integration (implied through TypeScript setup)
- **Database Migrations**: Drizzle Kit for schema management

### Third-Party Services
- **Nostr Relays**: Default relay pool including Damus, Snort, and Nostr.info
- **PostgreSQL Database**: Neon serverless database provider
- **Development Platform**: Replit-specific plugins and error overlays

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to dist/public
- **Backend**: ESBuild bundles Express server to dist/index.js
- **Database**: Drizzle migrations applied via `db:push` command

### Environment Configuration
- **Development**: Vite dev server with Express API proxy
- **Production**: Express serves static files and API endpoints
- **Database**: Environment variable for DATABASE_URL connection string

### File Structure
- **Client Code**: React app in client/ directory with src/ subdirectory
- **Server Code**: Express backend in server/ directory
- **Shared Code**: Domain models and schemas in shared/ directory
- **Configuration**: Root-level config files for build tools and TypeScript

The application implements a sophisticated academic discourse platform with decentralized architecture, comprehensive domain modeling, and modern web development practices. The codebase demonstrates clean separation of concerns with domain logic isolated from infrastructure concerns.