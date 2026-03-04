# Database Migration Guide

This guide covers how to create, manage, and apply database migrations safely.

## Table of Contents

1. [Migration Basics](#migration-basics)
2. [Development Workflow](#development-workflow)
3. [Production Deployment](#production-deployment)
4. [Common Migration Patterns](#common-migration-patterns)
5. [Rollback Procedures](#rollback-procedures)
6. [Best Practices](#best-practices)

## Migration Basics

### What is a Migration?

A migration is a set of SQL commands that modify the database schema. Prisma
tracks migrations in the `prisma/migrations` directory, with each migration
containing:

- `migration.sql` - SQL commands to apply changes
- Migration timestamp and name - For tracking and ordering

### Migration States

- **Pending**: Migration exists but hasn't been applied
- **Applied**: Migration successfully executed on database
- **Failed**: Migration started but encountered an error
- **Rolled back**: Migration was applied then reverted

## Development Workflow

### Creating Your First Migration

```bash
# 1. Ensure DATABASE_URL is set in .env
echo $DATABASE_URL

# 2. Create initial migration
yarn prisma migrate dev --name init

# Output:
# - Creates prisma/migrations/[timestamp]_init/
# - Applies migration to database
# - Generates Prisma Client
```

### Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
# Example: Add a new field to User model

# 2. Create migration with descriptive name
yarn prisma migrate dev --name add_user_role

# 3. Review generated SQL
cat prisma/migrations/[timestamp]_add_user_role/migration.sql

# 4. Test migration worked
yarn prisma studio
```

### Migration Naming Convention

Use clear, descriptive names that indicate what changed:

**Good names:**

- `add_user_role_field`
- `create_payment_tables`
- `add_app_status_index`
- `remove_deprecated_columns`

**Bad names:**

- `update` (too vague)
- `fix` (what was fixed?)
- `migration1` (not descriptive)

### Iterating During Development

```bash
# If you're still developing and haven't committed:
# Option 1: Reset and start over (deletes all data!)
yarn prisma migrate reset

# Option 2: Create new migration to fix previous one
yarn prisma migrate dev --name fix_previous_migration

# Option 3: Edit last migration (ONLY if not committed!)
# - Edit the SQL file
# - Run: yarn prisma migrate dev
```

### Working with Multiple Developers

```bash
# 1. Pull latest changes
git pull origin main

# 2. Check for new migrations
ls -la prisma/migrations/

# 3. Apply pending migrations
yarn prisma migrate dev

# 4. Resolve conflicts if any
# - If migration conflicts occur, you may need to:
#   a) Reset your database: yarn prisma migrate reset
#   b) Or create a new migration to reconcile: yarn prisma migrate dev
```

## Production Deployment

### Pre-Deployment Checklist

Before deploying migrations to production:

- [ ] Migrations tested on staging environment
- [ ] Database backup completed and verified
- [ ] Downtime window scheduled (if needed)
- [ ] Rollback plan documented
- [ ] Team notified of deployment
- [ ] Migration SQL reviewed by DBA

### Deploying Migrations

```bash
# Production deployments should use 'migrate deploy'
# This is non-interactive and suitable for CI/CD

yarn prisma migrate deploy

# This will:
# - Apply all pending migrations
# - NOT prompt for input
# - Exit with error code if fails
# - Safe to run in automated pipelines
```

### CI/CD Pipeline Integration

**GitHub Actions Example:**

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: yarn prisma migrate deploy

      - name: Deploy application
        run: |
          # Your deployment commands here
```

### Zero-Downtime Migrations

For large tables or high-traffic applications:

```bash
# 1. Add new column (nullable)
# migration: add_new_column.sql
ALTER TABLE users ADD COLUMN new_field TEXT NULL;

# 2. Deploy application v1 (writes to both old and new column)
# ... deploy code ...

# 3. Backfill data (run separately, not in migration)
# backfill.sql
UPDATE users SET new_field = old_field WHERE new_field IS NULL;

# 4. Deploy application v2 (uses new column only)
# ... deploy code ...

# 5. Make column NOT NULL (after backfill complete)
# migration: make_new_column_required.sql
ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;

# 6. Remove old column (optional, after monitoring period)
# migration: remove_old_column.sql
ALTER TABLE users DROP COLUMN old_field;
```

## Common Migration Patterns

### Adding a New Table

```prisma
// schema.prisma
model Payment {
  id        String   @id @default(cuid())
  userId    String
  amount    Decimal  @db.Decimal(10, 2)
  status    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}
```

```bash
yarn prisma migrate dev --name add_payment_table
```

### Adding a Column

```prisma
// Add to existing model
model User {
  // ... existing fields
  phoneNumber String? // New optional field
}
```

```bash
yarn prisma migrate dev --name add_user_phone_number
```

### Making Column Required (Safe Pattern)

```bash
# Step 1: Add nullable column
yarn prisma migrate dev --name add_required_field_nullable

# Step 2: Backfill data
psql $DATABASE_URL -c "UPDATE users SET new_field = 'default' WHERE new_field IS NULL;"

# Step 3: Make column required
# Update schema.prisma: new_field String (remove ?)
yarn prisma migrate dev --name make_new_field_required
```

### Adding an Index

```prisma
model App {
  // ... existing fields

  @@index([status, createdAt]) // Composite index for common query
}
```

```bash
yarn prisma migrate dev --name add_app_status_created_index
```

### Renaming a Column (Safe Pattern)

```bash
# Step 1: Add new column
# schema.prisma: Add new_name String?
yarn prisma migrate dev --name add_renamed_column

# Step 2: Backfill data
UPDATE users SET new_name = old_name;

# Step 3: Update application to use new column
# ... deploy code changes ...

# Step 4: Drop old column
# schema.prisma: Remove old_name field
yarn prisma migrate dev --name remove_old_column
```

### Adding an Enum

```prisma
enum UserRole {
  ADMIN
  USER
  MODERATOR
}

model User {
  // ... existing fields
  role UserRole @default(USER)
}
```

```bash
yarn prisma migrate dev --name add_user_role_enum
```

## Rollback Procedures

### Scenario 1: Migration Failed During Apply

```bash
# 1. Check migration status
yarn prisma migrate status

# 2. Mark failed migration as rolled back
yarn prisma migrate resolve --rolled-back [migration_name]

# 3. Fix the issue in schema.prisma

# 4. Create new migration
yarn prisma migrate dev --name fix_migration_name
```

### Scenario 2: Need to Undo Last Migration

```bash
# WARNING: This is destructive!

# 1. Restore database from backup
pg_restore -d spike_land backup.sql

# 2. Mark migration as rolled back
yarn prisma migrate resolve --rolled-back [migration_name]

# 3. Fix schema and create new migration
```

### Scenario 3: Production Rollback

```bash
# 1. Stop application (prevent writes)
# 2. Restore database from pre-migration backup
pg_restore -d spike_land production_backup_pre_migration.sql

# 3. Deploy previous application version
# 4. Mark migration as rolled back (if needed)
yarn prisma migrate resolve --rolled-back [migration_name]

# 5. Investigate issue before retrying
```

## Best Practices

### 1. Always Backup Before Migrations

```bash
# Create backup before migration
pg_dump -Fc spike_land > backup_$(date +%Y%m%d_%H%M%S).backup

# Run migration
yarn prisma migrate deploy

# If successful, can delete old backup after verification period
```

### 2. Test on Staging First

```bash
# Staging environment
DATABASE_URL=postgres://staging yarn prisma migrate deploy

# Monitor for issues, test application

# Production (only after staging success)
DATABASE_URL=postgres://production yarn prisma migrate deploy
```

### 3. Keep Migrations Small and Focused

**Good:**

- One migration per logical change
- Each migration does one thing well
- Easy to review and understand

**Bad:**

- Mixing table creation, column changes, and data updates
- Giant migrations that are hard to review
- Multiple unrelated changes in one migration

### 4. Review Generated SQL

```bash
# Always check what Prisma generated
cat prisma/migrations/[timestamp]_migration_name/migration.sql

# Look for:
# - Unexpected DROP commands
# - Missing indexes
# - Incorrect data types
# - Cascading deletes
```

### 5. Use Transactions (Default)

Prisma migrations run in transactions automatically, ensuring:

- All changes apply or none do
- No partial migrations
- Database stays consistent

### 6. Monitor Migration Duration

```bash
# For large tables, estimate migration time on staging
\timing on
ALTER TABLE large_table ADD COLUMN new_field TEXT;
# Check duration

# If >10 seconds, consider:
# - Running during low-traffic window
# - Breaking into smaller steps
# - Using zero-downtime pattern
```

### 7. Document Complex Migrations

Add comments in migration SQL:

```sql
-- Migration: add_user_verified_field
-- Purpose: Track email verification status
-- Affected rows: ~10,000 users
-- Estimated duration: <5 seconds
-- Rollback: Set verified = false for all users

ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT false;
CREATE INDEX idx_users_verified ON users(verified);
```

### 8. Coordinate Schema Changes with Code

**Backward Compatible Changes (Safe):**

- Adding nullable columns
- Adding new tables
- Adding indexes
- Making columns nullable

**Breaking Changes (Requires Coordination):**

- Removing columns
- Renaming columns
- Changing column types
- Adding NOT NULL constraints

**Deployment Order:**

1. Deploy backward-compatible schema change
2. Deploy code that uses new schema
3. Deploy cleanup migrations (remove old columns)

## Troubleshooting

### Migration Already Applied

```bash
# Error: Migration X has already been applied
yarn prisma migrate resolve --applied [migration_name]
```

### Schema Drift Detected

```bash
# Database schema doesn't match Prisma schema
# This happens when manual SQL changes were made

# Option 1: Reset (development only)
yarn prisma migrate reset

# Option 2: Create migration to match current state
yarn prisma db pull  # Update schema.prisma from database
yarn prisma migrate dev --name sync_schema
```

### Cannot Create Migration

```bash
# Error: Can't create migration - database has pending migrations

# Apply pending migrations first
yarn prisma migrate dev

# Then create new migration
yarn prisma migrate dev --name new_migration
```

### Migration Conflicts

```bash
# Multiple developers created migrations at same time

# 1. Pull latest changes
git pull origin main

# 2. Reset local migrations (if not pushed)
yarn prisma migrate reset

# 3. Apply team's migrations
yarn prisma migrate dev

# 4. Create your migration on top
yarn prisma migrate dev --name your_changes
```

## Monitoring Migration Health

### Check Migration Status

```bash
# Show applied and pending migrations
yarn prisma migrate status

# Output:
# ✓ 001_init (applied)
# ✓ 002_add_user_role (applied)
# ✗ 003_add_payment_table (pending)
```

### Verify Schema Sync

```bash
# Check if database matches schema.prisma
yarn prisma validate

# Pull current database schema
yarn prisma db pull
# Then compare with your schema.prisma
```

### Migration History

```bash
# View migration history
ls -la prisma/migrations/

# View specific migration
cat prisma/migrations/[timestamp]_name/migration.sql
```

## Additional Resources

- **Prisma Migrate Docs**:
  https://www.prisma.io/docs/concepts/components/prisma-migrate
- **Schema Evolution**:
  https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate
- **Production Best Practices**:
  https://www.prisma.io/docs/guides/database/production-troubleshooting

## Emergency Contacts

- **Database Administrator**: [Contact Info]
- **DevOps On-Call**: [Contact Info]
- **Migration Runbook**: [Link to detailed runbook]
