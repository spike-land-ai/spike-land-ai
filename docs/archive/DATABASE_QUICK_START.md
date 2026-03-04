# Database Quick Start

This is a condensed guide to get the database up and running quickly. For
comprehensive documentation, see [DATABASE_SETUP.md](./DATABASE_SETUP.md).

## Quick Setup (5 Minutes)

### Step 1: Start PostgreSQL Database

Choose one option:

#### Option A: Docker (Recommended)

```bash
docker run --name spike-land-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=spike_land \
  -p 5432:5432 \
  -d postgres:16-alpine
```

#### Option B: Use Cloud Provider

- **Supabase**: https://supabase.com (Free tier)
- **Railway**: https://railway.app (Simple setup)
- **Neon**: https://neon.tech (Serverless)

### Step 2: Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit .env and update DATABASE_URL
# For local Docker:
DATABASE_URL=postgresql://postgres:password@localhost:5432/spike_land?schema=public

# For Supabase (example):
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Step 3: Generate Prisma Client

```bash
# Generate types (no database changes)
yarn prisma generate
```

### Step 4: Run Migrations

```bash
# Create tables in database
yarn prisma migrate dev --name init

# This will:
# - Create all tables
# - Setup indexes
# - Generate Prisma Client
```

### Step 5: Verify Setup

```bash
# Open Prisma Studio to browse database
yarn prisma studio

# Or check with psql
psql postgresql://postgres:password@localhost:5432/spike_land -c "\dt"
```

## Database Schema Summary

### Core Tables

1. **users** - User accounts (NextAuth integration)
2. **accounts** - OAuth provider accounts (GitHub, Google)
3. **sessions** - Active user sessions
4. **verification_tokens** - Email verification
5. **apps** - User-created applications
6. **requirements** - App requirements/features
7. **monetization_models** - App pricing models

### Key Relationships

```
User (1) ----< (N) App
App (1) ----< (N) Requirement
App (1) ----< (N) MonetizationModel
App (1) ----< (N) App (self-reference for forks)
```

## Common Commands

```bash
# Generate Prisma Client after schema changes
yarn prisma generate

# Create new migration
yarn prisma migrate dev --name your_migration_name

# Apply migrations to production
yarn prisma migrate deploy

# Open database browser
yarn prisma studio

# Reset database (DEV ONLY - deletes all data!)
yarn prisma migrate reset

# Format schema file
yarn prisma format

# Validate schema
yarn prisma validate
```

## Usage in Code

```typescript
// Import Prisma client
import prisma from "@/lib/prisma";

// Query examples
const users = await prisma.user.findMany();
const user = await prisma.user.findUnique({
  where: { email: "user@example.com" },
});

// Create with relations
const app = await prisma.app.create({
  data: {
    name: "My App",
    description: "A great app",
    userId: user.id,
    status: "ACTIVE",
    requirements: {
      create: [
        { description: "User authentication", priority: "HIGH" },
      ],
    },
  },
  include: {
    requirements: true,
  },
});

// Update
await prisma.app.update({
  where: { id: app.id },
  data: { status: "ACTIVE" },
});

// Delete
await prisma.app.delete({
  where: { id: app.id },
});
```

## Troubleshooting

### Error: "Can't reach database server"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start if not running
docker start spike-land-postgres

# Verify connection string
echo $DATABASE_URL
```

### Error: "Environment variable not found: DATABASE_URL"

```bash
# Make sure .env file exists
ls -la .env

# Verify DATABASE_URL is set
cat .env | grep DATABASE_URL

# Prisma loads from .env automatically
```

### Error: "Migration failed"

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Reset and try again (DEV ONLY)
yarn prisma migrate reset
yarn prisma migrate dev --name init
```

### Generated client not found

```bash
# Generate Prisma Client
yarn prisma generate

# Check if generated
ls -la src/generated/prisma
```

## Next Steps

1. **Run migrations**: `yarn prisma migrate dev --name init`
2. **Test connection**: `yarn prisma studio`
3. **Start development**: `npm run dev`
4. **Read full docs**: See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for:
   - Backup strategies
   - Monitoring setup
   - Performance tuning
   - High availability
   - Disaster recovery

## Production Deployment

Before deploying to production:

1. Use a production-grade database (Supabase, AWS RDS, etc.)
2. Set up connection pooling (PgBouncer)
3. Configure automated backups
4. Set up monitoring and alerts
5. Test disaster recovery procedures

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for complete production setup
guide.
