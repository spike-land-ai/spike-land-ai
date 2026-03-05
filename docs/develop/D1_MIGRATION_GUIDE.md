# D1 Migration Guide: Zero-Downtime Rules

## Core Rules

1. **Always ADD COLUMN with a DEFAULT value.**
   Without a DEFAULT, existing rows get NULL which can break NOT NULL constraints
   or code that doesn't expect NULL.

2. **Never DROP COLUMN in the same deploy.**
   Mark the column as deprecated, deploy code that stops reading it, then remove
   the column in a later migration.

3. **Never RENAME COLUMN directly.**
   Instead: add the new column, migrate data, deploy code using the new column,
   then drop the old column in a subsequent deploy.

4. **Always use CREATE TABLE IF NOT EXISTS.**
   Prevents failures if migrations are re-run or applied out of order.

5. **Test migrations locally first.**
   ```bash
   npx wrangler d1 migrations apply <db-name> --local
   ```

6. **D1 migrations MUST run BEFORE worker deployment.**
   CI already enforces this — migrations are applied before any worker deploy
   step. Never change this order.

## Multi-Deploy Column Rename Pattern

```
Deploy 1: ADD COLUMN new_name ... DEFAULT ...
Deploy 2: Backfill data (UPDATE table SET new_name = old_name WHERE new_name IS NULL)
Deploy 3: Switch application code to use new_name
Deploy 4: DROP COLUMN old_name
```

## CI Validation

The script `.github/scripts/validate-migrations.sh` runs in CI before
migrations are applied. It scans for risky patterns and emits warnings (does not
block the pipeline, since some patterns may be intentional).
