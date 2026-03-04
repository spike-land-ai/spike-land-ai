# Database Setup Guide

This guide covers the complete database setup for Spike Land platform using
Prisma ORM with PostgreSQL.

## Overview

- **ORM**: Prisma 7.4.1
- **Database**: PostgreSQL 14+ (with connection pooling via @prisma/adapter-pg)
- **Schema Location**: `/prisma/schema.prisma`
- **Client Location**: `@prisma/client` (standard location)
- **Connection Adapter**: @prisma/adapter-pg (for enhanced connection pooling)

## Quick Start

For developers who want to get the database running immediately:

```bash
# 1. Start PostgreSQL (Docker)
docker run --name spike-land-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=spike_land \
  -p 5432:5432 -d postgres:16-alpine

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and set:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/spike_land
# AUTH_SECRET=$(openssl rand -base64 32)

# 3. Run migrations
yarn db:migrate

# 4. Seed development data (optional)
yarn db:seed

# 5. Start development server
yarn dev
```

See sections below for detailed configuration, production setup, and
troubleshooting.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Database Options](#production-database-options)
4. [Staging Environment (next.spike.land)](#staging-environment-nextspikelland)
5. [Schema Overview](#schema-overview)
6. [Running Migrations](#running-migrations)
7. [Database Seeding](#database-seeding)
8. [Backup and Recovery](#backup-and-recovery)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ installed locally OR access to a cloud PostgreSQL instance
- Basic understanding of SQL and database concepts

## Local Development Setup

### Option 1: Local PostgreSQL with Docker

The fastest way to get started with PostgreSQL locally:

```bash
# Pull and run PostgreSQL container
docker run --name spike-land-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=spike_land \
  -p 5432:5432 \
  -d postgres:16-alpine

# Verify it's running
docker ps | grep spike-land-postgres
```

### Option 2: Local PostgreSQL Installation

#### macOS (using Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb spike_land
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb spike_land
```

### Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Update the `DATABASE_URL` in `.env.local`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/spike_land?schema=public
```

**Note**: The application uses `.env.local` for local development (which is
gitignored). The `.env.example` file provides a template with all available
configuration options.

## Production Database Options

### Recommended Cloud Providers

#### 1. Supabase (Recommended for Next.js)

- Free tier: 500MB database, connection pooling included
- Setup: https://supabase.com/
- Connection string format:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### 2. Railway

- Easy deployment, PostgreSQL included
- Setup: https://railway.app/
- Connection string provided in Railway dashboard

#### 3. Neon (Legacy)

- Serverless PostgreSQL with branching
- Free tier: 3GB storage
- Setup: https://neon.tech/
- **Note**: Neon was the original database provider. The project is migrating to
  AWS Aurora PostgreSQL. See [AWS_MIGRATION.md](./AWS_MIGRATION.md) for status.

#### 4. AWS Aurora PostgreSQL (Target Production)

- Production-grade, multi-region with Global Database
- Aurora writer in us-east-1, reader in eu-west-1
- Staging and production infra provisioned via Terraform
- See [AWS_MIGRATION.md](./AWS_MIGRATION.md) for full details

## Staging Environment (next.spike.land)

Spike Land uses **Neon Database Branching** to create an instant staging
environment that mirrors production data. This allows testing with real-world
data without affecting production.

### How Staging Works

1. **Neon Branch**: A `staging` branch is created from the `main` (production)
   branch
2. **Copy-on-Write**: Uses Neon's instant branching - no actual data copying
3. **Isolated Endpoint**: Staging has its own database connection string
4. **Daily Reset**: Automatically resets to match production at 3 AM UTC

### Setting Up the Staging Branch

#### Prerequisites

1. **Neon API Key**: Get from https://console.neon.tech/app/settings/api-keys
2. **Neon CLI** (optional): `npm install -g neonctl`

#### Create Staging Branch

```bash
# Using Neon CLI
neonctl branches create \
  --project-id dark-flower-44506554 \
  --name staging \
  --parent main \
  --compute-endpoint-type read_write

# Note the new endpoint URL for staging
```

#### GitHub Secrets Required

Add these secrets to your GitHub repository:

| Secret            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `NEON_API_KEY`    | Neon API key with branch management permissions |
| `NEON_PROJECT_ID` | `dark-flower-44506554`                          |

### Vercel Configuration for Staging

Configure `next.spike.land` in Vercel:

| Variable       | Value                         |
| -------------- | ----------------------------- |
| `DATABASE_URL` | Staging branch connection URL |
| `NEXTAUTH_URL` | `https://next.spike.land`     |

### Resetting the Staging Database

#### Automatic Daily Reset

A GitHub Action runs daily at 3 AM UTC to reset the staging database:

- See `.github/workflows/staging-reset.yml`
- Can be manually triggered from GitHub Actions UI

#### Manual Reset

```bash
# Show warning and instructions
yarn reset:db

# Actually perform reset (requires confirmation)
yarn reset:db --confirm
```

This calls the Neon API to reset the `staging` branch to match `main`
(production).

### Environment Variables for Staging

Add to `.env.local` for local staging development:

```env
# Neon Database Branching
NEON_API_KEY=your-neon-api-key
NEON_PROJECT_ID=dark-flower-44506554
```

### Database Protection

The staging environment is recognized as safe by the db-protection utility:

- Connection strings containing `next.spike.land` are allowed
- Connection strings containing `staging` are allowed
- Production patterns (`spike.land` without `next.`) are blocked

See `prisma/lib/db-protection.ts` for the full pattern matching logic.

### Staging vs Production

| Aspect       | Production (spike.land) | Staging (next.spike.land)        |
| ------------ | ----------------------- | -------------------------------- |
| Branch       | `main`                  | `staging`                        |
| Data         | Live user data          | Copy of production (reset daily) |
| Endpoint     | Production compute      | Staging compute                  |
| Reset        | Never                   | Daily at 3 AM UTC                |
| Safe for E2E | No                      | Yes                              |

### Connection Pooling for Production

**Important**: Spike Land uses the `@prisma/adapter-pg` package for enhanced
connection pooling, which provides better performance for serverless
environments.

The database connection is configured in `/src/lib/prisma.ts`:

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});
```

For serverless/edge deployments (Vercel, AWS Lambda), use connection pooling:

```env
# Pooled connection (for Prisma Client queries)
DATABASE_URL=postgresql://user:password@host:6543/db?pgbouncer=true

# Direct connection (for Prisma Migrate - optional, only if using separate migration URL)
DIRECT_URL=postgresql://user:password@host:5432/db
```

Current `prisma/schema.prisma` configuration:

```prisma
datasource db {
  provider = "postgresql"
  # DATABASE_URL is read from environment - no directUrl needed with adapter-pg
}
```

**Note**: The schema does not specify a `url` or `directUrl` in the datasource
block because the connection is managed through the PrismaPg adapter, which
provides superior connection pooling for serverless environments.

## Schema Overview

The Spike Land database schema is extensive, supporting multiple platform
features. Below are the core models. For the complete schema, see
`/prisma/schema.prisma`.

### Core Models

#### User Model (NextAuth Integration + Extended Features)

The User model is central to the platform, integrating with NextAuth for
authentication and supporting various platform features:

```prisma
model User {
  id                   String    @id @default(cuid())
  name                 String?
  email                String?   @unique
  emailVerified        DateTime?
  image                String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  stripeCustomerId     String?   @unique
  role                 UserRole  @default(USER)
  referralCode         String?   @unique
  referredById         String?
  referralCount        Int       @default(0)
  passwordHash         String?   // For email/password authentication

  // Relations (selected examples)
  accounts             Account[]
  sessions             Session[]
  enhancedImages       EnhancedImage[]
  tokenBalance         UserTokenBalance?
  subscription         Subscription?
  // ... and many more relations
}
```

**Key Features:**

- **Stable User IDs**: User IDs are generated deterministically from email
  addresses using a salt (see Authentication section below)
- **Multiple Auth Methods**: Supports OAuth (GitHub, Google, Facebook, Apple)
  and email/password
- **Referral System**: Built-in referral tracking with codes and rewards
- **Token System**: Integration with token balance and transactions

### Authentication and User ID Generation

Spike Land implements a sophisticated authentication system with stable user
IDs:

#### Stable User IDs

Unlike traditional NextAuth setups that generate random CUIDs, Spike Land
creates **deterministic user IDs** based on email addresses:

```typescript
// From src/auth.config.ts
function createStableUserId(email: string): string {
  const salt = process.env.USER_ID_SALT || process.env.AUTH_SECRET;
  // Creates a deterministic hash: user_<hash>
  // Same email always gets the same ID
}
```

**Benefits:**

- Same user gets same ID across different OAuth providers (GitHub, Google, etc.)
- Predictable IDs for testing and debugging
- Consistent user identity even if switching login methods

**Important Considerations:**

- `USER_ID_SALT` should **never be rotated** in production (would change all
  user IDs)
- If user changes email at OAuth provider, they get a NEW user ID and lose
  access to previous data
- This is intentional to maintain 1:1 email-to-identity relationship

#### Required Environment Variables

```env
# Primary authentication secret (REQUIRED)
AUTH_SECRET=<generate-with-openssl-rand-base64-32>

# User ID salt (RECOMMENDED for production)
# If not set, AUTH_SECRET is used as fallback
# NEVER rotate this value after setting in production
USER_ID_SALT=<generate-with-openssl-rand-base64-32>

# OAuth Providers (configure as needed)
GITHUB_ID=<your-github-oauth-client-id>
GITHUB_SECRET=<your-github-oauth-client-secret>

GOOGLE_ID=<your-google-oauth-client-id>
GOOGLE_SECRET=<your-google-oauth-client-secret>

AUTH_FACEBOOK_ID=<your-facebook-oauth-app-id>
AUTH_FACEBOOK_SECRET=<your-facebook-oauth-app-secret>
```

See `.env.example` for complete OAuth setup instructions.

### Platform Feature Models

The schema supports multiple platform features. Key model groups include:

#### Image Enhancement System

Core models for AI-powered image enhancement:

- **EnhancedImage**: Stores uploaded and enhanced images
- **ImageEnhancementJob**: Tracks enhancement jobs with status, tier, cost
- **EnhancementPipeline**: Reusable enhancement configurations
- **Album**: User photo albums with privacy settings
- **AlbumImage**: Junction table linking images to albums

**Enhancement Tiers**: FREE, TIER_1K (1024px), TIER_2K (2048px), TIER_4K
(4096px)

#### Token Economy

- **UserTokenBalance**: User token balances and subscription tier
- **TokenTransaction**: Token earn/spend history
- **TokensPackage**: Purchasable token packages
- **StripePayment**: Payment records

**Token Transaction Types**: EARN_REGENERATION, EARN_PURCHASE, EARN_BONUS,
SPEND_ENHANCEMENT, REFUND

#### Subscription System

- **Subscription**: User subscription records with Stripe integration
- **SubscriptionPlan**: Available subscription plans

**Subscription Tiers**: FREE, BASIC, STANDARD, PREMIUM

#### Referral System

- **Referral**: Referral tracking between users
- **Voucher**: Promotional vouchers
- **VoucherRedemption**: Voucher usage tracking

#### Campaign Analytics

- **VisitorSession**: Tracks visitor sessions with UTM parameters
- **PageView**: Individual page views
- **AnalyticsEvent**: Custom event tracking
- **CampaignAttribution**: Links conversions to campaigns
- **CampaignLink**: Maps UTM campaigns to platform campaign IDs

#### Merch / Print-on-Demand

- **MerchCategory**: Product categories
- **MerchProduct**: Products with POD provider integration
- **MerchVariant**: Product variants (sizes, colors)
- **MerchCart**: Shopping carts
- **MerchOrder**: Orders with shipping and payment tracking
- **MerchShipment**: Shipment tracking

#### Marketing Platform Integration

- **MarketingAccount**: Connected Facebook/Google Ads accounts
- **Platform support**: FACEBOOK, GOOGLE_ADS

#### Browser Automation (Box System)

- **Box**: Virtual browser instances
- **BoxTier**: Pricing tiers for boxes
- **BoxAction**: Box lifecycle actions
- **AgentTask**: Automated browser tasks
- **BoxMessage**: Agent conversation history

#### Audio Mixer

- **AudioMixerProject**: User audio projects
- **AudioTrack**: Individual audio tracks with R2 storage

#### External Agent Integration

- **ExternalAgentSession**: Jules/Codex agent sessions
- **AgentSessionActivity**: Agent activity logs

### NextAuth Required Models

- **Account**: OAuth provider accounts (GitHub, Google)
- **Session**: Active user sessions
- **VerificationToken**: Email verification tokens

### Database Indexes

Performance-critical indexes included:

- User email (unique)
- App userId, forkedFrom, status, domain
- Requirement appId, status, priority
- Account provider + providerAccountId

## Running Migrations

### Initial Migration (First Time Setup)

Once you have a database configured:

```bash
# Generate Prisma Client (types only, no DB changes)
yarn db:generate

# Create and apply initial migration
yarn db:migrate

# This will:
# 1. Create migration files in prisma/migrations/
# 2. Apply migrations to your database
# 3. Generate Prisma Client with types
```

**Available Database Scripts** (from `package.json`):

```bash
yarn db:generate        # Generate Prisma Client
yarn db:migrate         # Create and apply migration (dev)
yarn db:migrate:deploy  # Deploy migrations (production)
yarn db:migrate:reset   # Reset database (WARNING: deletes all data)
yarn db:push            # Push schema without migration (dev only)
yarn db:seed            # Run seed script
yarn db:seed-e2e        # Seed database for E2E tests
yarn db:cleanup-e2e     # Clean up E2E test data
yarn db:studio          # Open Prisma Studio GUI
yarn db:validate        # Validate schema
yarn db:format          # Format schema file
```

### Development Workflow

```bash
# After schema changes, create a new migration
yarn db:migrate

# You'll be prompted to name the migration
# Examples: add_user_role_field, create_merch_tables, etc.
```

### Production Migrations

```bash
# Deploy migrations to production (non-interactive)
yarn db:migrate:deploy

# This should be run in CI/CD pipeline
```

**Note**: The project uses a postinstall hook that automatically runs
`yarn db:generate` after dependencies are installed, ensuring Prisma Client is
always up-to-date.

### Migration Best Practices

1. **Always backup before migrations** in production
2. **Test migrations** on staging environment first
3. **Use descriptive names** for migrations
4. **Never edit applied migrations** - create new ones
5. **Review generated SQL** before applying to production

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data!
yarn prisma migrate reset

# This will:
# 1. Drop database
# 2. Recreate database
# 3. Apply all migrations
# 4. Run seed script (if configured)
```

## Backup and Recovery

### Backup Strategy

#### Automated Daily Backups

**PostgreSQL pg_dump (Recommended)**

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="spike_land"
DB_USER="postgres"
DB_HOST="localhost"

# Create backup directory
mkdir -p $BACKUP_DIR

# Run backup
pg_dump -h $DB_HOST -U $DB_USER -F c -b -v -f \
  "$BACKUP_DIR/spike_land_$TIMESTAMP.backup" $DB_NAME

# Compress backup
gzip "$BACKUP_DIR/spike_land_$TIMESTAMP.backup"

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: spike_land_$TIMESTAMP.backup.gz"
```

**Setup Cron Job (Daily at 2 AM)**

```bash
crontab -e

# Add line:
0 2 * * * /path/to/backup-database.sh >> /var/log/postgres-backup.log 2>&1
```

#### Cloud Provider Backups

**Supabase:**

- Automatic daily backups (Pro plan)
- Point-in-time recovery (PITR)
- Dashboard: Database > Backups

**Railway:**

- Automatic daily snapshots
- Manual snapshots via dashboard

**AWS RDS:**

- Automated backups with retention period
- Manual snapshots before major changes

### Backup Retention Policy

- **Daily backups**: Keep 30 days
- **Weekly backups**: Keep 12 weeks
- **Monthly backups**: Keep 12 months
- **Pre-migration backups**: Keep indefinitely

### Recovery Procedures

#### Restore from pg_dump Backup

```bash
# 1. Stop application to prevent writes
# 2. Drop existing database (if needed)
dropdb spike_land

# 3. Create fresh database
createdb spike_land

# 4. Restore from backup
pg_restore -h localhost -U postgres -d spike_land \
  /path/to/spike_land_20250101_020000.backup

# 5. Verify data integrity
psql -U postgres -d spike_land -c "SELECT COUNT(*) FROM users;"

# 6. Restart application
```

#### Point-in-Time Recovery (PITR)

For AWS RDS or Supabase Pro:

```bash
# Use cloud provider dashboard or CLI
# Example for AWS RDS:
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier spike-land-prod \
  --target-db-instance-identifier spike-land-restored \
  --restore-time 2025-01-15T14:30:00Z
```

### Testing Backups

**CRITICAL: Untested backups don't exist!**

Monthly backup test procedure:

```bash
# 1. Create test database
createdb spike_land_test

# 2. Restore backup to test database
pg_restore -d spike_land_test /path/to/latest/backup.gz

# 3. Verify critical data
psql -U postgres -d spike_land_test <<EOF
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM apps;
SELECT COUNT(*) FROM requirements;
EOF

# 4. Cleanup
dropdb spike_land_test
```

## Monitoring and Maintenance

### Key Metrics to Monitor

1. **Connection Pool**
   - Active connections
   - Idle connections
   - Connection wait time

2. **Query Performance**
   - Slow queries (>100ms)
   - Query execution plans
   - Index usage

3. **Database Size**
   - Total database size
   - Table sizes
   - Index sizes

4. **Replication Lag** (if using replicas)
   - Lag time in seconds
   - Replay lag

### Monitoring Queries

**Active Connections**

```sql
SELECT
  count(*) as total_connections,
  state,
  application_name
FROM pg_stat_activity
WHERE datname = 'spike_land'
GROUP BY state, application_name;
```

**Slow Queries (requires pg_stat_statements)**

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'spike_land')
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Table Sizes**

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Index Usage**

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

**Unused Indexes (candidates for removal)**

```sql
SELECT
  schemaname || '.' || tablename AS table,
  indexname,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
FROM pg_stat_user_indexes i
WHERE idx_scan = 0
  AND schemaname = 'public'
  AND indexrelid NOT IN (
    SELECT conindid FROM pg_constraint
  )
ORDER BY pg_relation_size(i.indexrelid) DESC;
```

### Routine Maintenance

#### Weekly Maintenance (Automated)

**VACUUM and ANALYZE**

```sql
-- Run weekly to reclaim space and update statistics
VACUUM ANALYZE;

-- Or per table
VACUUM ANALYZE users;
VACUUM ANALYZE apps;
```

**Automate with cron:**

```bash
# Add to crontab (Sundays at 3 AM)
0 3 * * 0 psql -U postgres -d spike_land -c "VACUUM ANALYZE;" >> /var/log/postgres-maintenance.log 2>&1
```

#### Monthly Maintenance

1. **Review slow queries** and optimize indexes
2. **Check for bloat** in tables and indexes
3. **Review and test backups**
4. **Update statistics** for query planner
5. **Check disk space** and plan capacity

#### Monitoring Setup with Alerting

**Key alerts to configure:**

1. **Connection Pool Exhaustion**
   - Alert when >80% connections used
   - Action: Scale connection pool or investigate leaks

2. **Replication Lag** (if using replicas)
   - Alert when lag >30 seconds
   - Action: Check network, disk I/O

3. **Database Size**
   - Alert when >80% disk space used
   - Action: Cleanup, archive, or scale storage

4. **Slow Query Increase**
   - Alert when >10 queries taking >1 second
   - Action: Review query plans, add indexes

5. **Failed Backups**
   - Alert immediately on backup failure
   - Action: Investigate and re-run backup

### Connection Pooling Configuration

**Prisma Connection Pool (Application Layer)**

Spike Land uses `@prisma/adapter-pg` for connection pooling. Current
`prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  # No url specified - managed by adapter in src/lib/prisma.ts
}
```

The connection is configured in `/src/lib/prisma.ts`:

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});
```

**Environment Configuration:**

```env
# Basic connection
DATABASE_URL=postgresql://user:pass@host:5432/db

# With PgBouncer (for serverless environments)
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
```

**Recommended Pool Sizes:**

- Development: Default (managed by adapter)
- Production (single instance): Default (managed by adapter)
- Production (serverless): Use external pooler (PgBouncer) with
  `@prisma/adapter-pg`

**PgBouncer Configuration (Production)**

```ini
[databases]
spike_land = host=localhost port=5432 dbname=spike_land

[pgbouncer]
listen_port = 6543
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
server_lifetime = 3600
server_idle_timeout = 600
```

## High Availability Setup

### Master-Slave Replication (Read Replicas)

**Use case:** Scale read-heavy workloads

**Setup for AWS RDS:**

1. Create read replica via AWS Console or CLI
2. Update application to use read replica for queries
3. Keep write operations on primary

**Prisma configuration for read replicas:**

To implement read replicas, create separate Prisma Client instances:

```typescript
// src/lib/prisma-read.ts (create this file)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const readConnectionString = process.env.DATABASE_READ_URL;
if (!readConnectionString) {
  throw new Error("DATABASE_READ_URL not configured");
}

const adapter = new PrismaPg({ connectionString: readConnectionString });
export const prismaRead = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});
```

Then use in your application:

```typescript
import prisma from "@/lib/prisma"; // Write operations
import { prismaRead } from "@/lib/prisma-read"; // Read operations

// Read from replica
const users = await prismaRead.user.findMany();

// Write to primary
await prisma.user.create({ data: { ... } });
```

### Failover Procedures

**Automatic Failover (Cloud Providers):**

- AWS RDS: Multi-AZ deployment (automatic)
- Supabase: Built-in failover
- Railway: Platform handles failover

**Manual Failover (Self-hosted):**

```bash
# 1. Promote replica to primary
pg_ctl promote -D /var/lib/postgresql/data

# 2. Update application connection string
# Point DATABASE_URL to new primary

# 3. Restart application
systemctl restart spike-land-app

# 4. Configure old primary as replica (after fixing)
```

## Disaster Recovery Runbook

### Scenario 1: Database Corruption

**Detection:** Application errors, data inconsistencies **RTO:** 1 hour |
**RPO:** Last backup (24 hours max)

1. Stop application to prevent further corruption
2. Identify corruption extent with `SELECT * FROM [table]`
3. Restore from latest backup to test database
4. Verify data integrity in test database
5. If valid, promote test database to primary
6. Update application connection string
7. Restart application
8. Monitor for errors

### Scenario 2: Accidental Data Deletion

**Detection:** User reports, monitoring alerts **RTO:** 30 minutes | **RPO:**
Point-in-time (if enabled)

1. Identify deletion timestamp
2. If PITR available: Restore to point before deletion
3. If no PITR: Restore from backup, manually recover deleted records
4. Compare restored data with current database
5. Merge recovered data using SQL INSERT statements
6. Verify data consistency

### Scenario 3: Database Server Failure

**Detection:** Connection failures, health checks failing **RTO:** 15 minutes |
**RPO:** 0 (with replication)

1. Check if replica is available and healthy
2. Promote replica to primary (automatic with RDS Multi-AZ)
3. Update application connection string (if needed)
4. Verify application connectivity
5. Monitor replication lag (if new replica spawned)
6. Investigate and repair failed primary

### Scenario 4: Complete Data Center Outage

**Detection:** All services unavailable **RTO:** 2 hours | **RPO:** Last backup
(24 hours max)

1. Activate disaster recovery site
2. Restore latest backup to new database instance
3. Update DNS to point to DR site
4. Apply any transaction logs (if available)
5. Start application in DR environment
6. Verify functionality and data integrity
7. Communicate status to users

## Security Best Practices

1. **Least Privilege Access**
   - Application user: Only necessary permissions
   - Admin user: Full access, restricted by IP
   - Readonly user: For analytics and reporting

2. **Connection Security**
   - Always use SSL/TLS in production
   - Verify SSL certificates
   - Use connection string with `sslmode=verify-full`

3. **Secrets Management**
   - Never commit `.env` file to git
   - Use secret management service (AWS Secrets Manager, Vault)
   - Rotate database passwords quarterly

4. **Audit Logging**
   - Enable PostgreSQL audit logging
   - Log all DDL statements (CREATE, ALTER, DROP)
   - Log failed authentication attempts

5. **Regular Updates**
   - Keep PostgreSQL version updated
   - Apply security patches promptly
   - Update Prisma regularly

## Troubleshooting

### Connection Issues

**Error: "Can't reach database server"**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if port is open
nc -zv localhost 5432

# Verify connection string
echo $DATABASE_URL
```

**Error: "Too many connections"**

```bash
# Check current connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Increase max_connections (requires restart)
# Edit postgresql.conf
max_connections = 200
```

### Migration Issues

**Error: "Migration failed"**

```bash
# Mark migration as rolled back
yarn prisma migrate resolve --rolled-back <migration_name>

# Fix issue and re-run
yarn prisma migrate dev
```

**Error: "Database schema is not in sync"**

```bash
# Reset migration state (dev only!)
yarn prisma migrate reset

# Production: Create new migration to sync
yarn prisma migrate dev --name sync_schema
```

### Performance Issues

**Slow Queries**

```sql
-- Enable query logging
ALTER DATABASE spike_land SET log_min_duration_statement = 100;

-- Review slow queries in log files
tail -f /var/log/postgresql/postgresql-*.log | grep "duration:"
```

**High CPU Usage**

```sql
-- Find expensive queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Kill runaway query (if needed)
SELECT pg_cancel_backend(<pid>);
```

## Database Seeding

The project includes several seed scripts for different purposes:

### Development Seeding

```bash
# Main seed script - creates basic data for development
yarn db:seed

# Seed vouchers specifically
yarn db:seed-vouchers

# Seed merch products
yarn prisma db seed -- --file=prisma/seed-merch.ts

# Seed box tiers
yarn prisma db seed -- --file=prisma/seed-box-tiers.ts
```

### E2E Testing

```bash
# Seed database for E2E tests
yarn db:seed-e2e

# Clean up E2E test data
yarn db:cleanup-e2e
```

**Important**: The E2E seed creates deterministic test data with known IDs. See
`prisma/seed-e2e.ts` for details.

### Seed Script Locations

- `/prisma/seed.ts` - Main development seed
- `/prisma/seed-enhanced.ts` - Enhanced seeding with additional data
- `/prisma/seed-vouchers.ts` - Voucher codes
- `/prisma/seed-merch.ts` - Merch products and categories
- `/prisma/seed-box-tiers.ts` - Box pricing tiers
- `/prisma/seed-e2e.ts` - E2E test data
- `/prisma/cleanup-e2e.ts` - E2E cleanup

## Environment Variables Summary

Required variables for database setup:

```env
# Database Connection (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication (REQUIRED)
AUTH_SECRET=<generate-with-openssl-rand-base64-32>

# User ID Salt (RECOMMENDED for production)
USER_ID_SALT=<generate-with-openssl-rand-base64-32>

# OAuth Providers (configure as needed)
GITHUB_ID=<your-github-client-id>
GITHUB_SECRET=<your-github-secret>
GOOGLE_ID=<your-google-client-id>
GOOGLE_SECRET=<your-google-secret>
AUTH_FACEBOOK_ID=<your-facebook-app-id>
AUTH_FACEBOOK_SECRET=<your-facebook-secret>
```

See `.env.example` for the complete list of available configuration options.

## Additional Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **Prisma Adapter for PostgreSQL**:
  https://www.prisma.io/docs/orm/overview/databases/postgresql
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **NextAuth.js Documentation**: https://next-auth.js.org/
- **Neon Database**: https://neon.tech/docs
- **Database Performance Tuning**:
  https://wiki.postgresql.org/wiki/Performance_Optimization

## Project-Specific Documentation

- **Token System**: [docs/architecture/TOKEN_SYSTEM.md](./TOKEN_SYSTEM.md)
- **API Reference**: [docs/architecture/API_REFERENCE.md](./API_REFERENCE.md)
- **Database Schema**:
  [docs/architecture/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Features Overview**: [docs/features/FEATURES.md](../features/FEATURES.md)

## Support and Maintenance

For issues or questions:

1. Check the documentation in `/docs`
2. Review the schema in `/prisma/schema.prisma`
3. Check migration history in `/prisma/migrations`
4. Use Prisma Studio for visual debugging: `yarn db:studio`

**Database Administrator**: Contact via GitHub issues **Project Owner**: Zoltan
Erdos (@zerdos)
