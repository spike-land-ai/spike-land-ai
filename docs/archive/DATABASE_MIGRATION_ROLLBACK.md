# Database Migration Rollback Guide

This document outlines procedures for rolling back database migrations,
particularly for the voucher system tables.

## Voucher System Tables

The voucher system adds the following tables:

- `Voucher` - Stores voucher codes and their configurations
- `VoucherRedemption` - Tracks which users have redeemed which vouchers

### Rollback Procedure

**Prerequisites:**

- Database backup before rollback
- Access to Prisma CLI
- Production database connection string

**Step 1: Create a Backup**

```bash
# PostgreSQL
pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Prisma
yarn prisma db execute --schema=./prisma/schema.prisma --file=backup.sql
```

**Step 2: Remove Dependent Data First**

```sql
-- Delete all voucher redemptions first (foreign key constraint)
DELETE FROM "VoucherRedemption";

-- Delete all vouchers
DELETE FROM "Voucher";
```

**Step 3: Drop Tables (If Full Rollback Needed)**

```sql
-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS "VoucherRedemption";
DROP TABLE IF EXISTS "Voucher";

-- Drop enums
DROP TYPE IF EXISTS "VoucherType";
DROP TYPE IF EXISTS "VoucherStatus";
```

**Step 4: Update Prisma Schema**

Remove the voucher-related models from `prisma/schema.prisma`:

- `Voucher` model
- `VoucherRedemption` model
- `VoucherType` enum
- `VoucherStatus` enum

**Step 5: Generate New Prisma Client**

```bash
yarn prisma generate
```

### Partial Rollback (Keep Structure, Clear Data)

If you only need to clear voucher data without removing the feature:

```sql
-- Reset all vouchers to initial state
UPDATE "Voucher" SET "currentUses" = 0, "status" = 'ACTIVE';

-- Clear redemption history
DELETE FROM "VoucherRedemption";

-- Clear related token transactions
DELETE FROM "TokenTransaction" WHERE "source" = 'voucher_redemption';
```

### Token Transaction Rollback

If voucher redemptions granted tokens incorrectly:

```sql
-- Find affected transactions
SELECT * FROM "TokenTransaction"
WHERE "source" = 'voucher_redemption'
AND "createdAt" > '2024-01-01';

-- Reverse specific transactions (adjust balances)
UPDATE "UserTokenBalance" utb
SET "balance" = utb."balance" - tt."amount"
FROM "TokenTransaction" tt
WHERE utb."userId" = tt."userId"
AND tt."source" = 'voucher_redemption'
AND tt."createdAt" > '2024-01-01';

-- Delete the transaction records
DELETE FROM "TokenTransaction"
WHERE "source" = 'voucher_redemption'
AND "createdAt" > '2024-01-01';
```

## Recovery Procedures

### If Migration Failed Mid-Way

1. Check Prisma migration status:
   ```bash
   yarn prisma migrate status
   ```

2. Reset to last known good state:
   ```bash
   yarn prisma migrate reset --skip-seed
   ```

3. Apply migrations up to the good state:
   ```bash
   yarn prisma migrate deploy
   ```

### If Data Corruption Detected

1. Stop the application immediately
2. Restore from backup
3. Investigate root cause before redeploying

## Testing Rollback

Before running in production, test the rollback procedure:

1. Create a staging database copy
2. Run the rollback procedure
3. Verify application still functions
4. Verify no orphaned data remains

## Emergency Contacts

- Database Admin: [Contact info]
- DevOps Team: [Contact info]
- On-call Engineer: [Contact info]

## Related Documentation

- [Database Schema](./DATABASE_SCHEMA.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Voucher System](./VOUCHER_SYSTEM.md)
