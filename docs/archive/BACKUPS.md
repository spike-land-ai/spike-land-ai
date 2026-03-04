# Database Backup and Restore

> **Last Updated**: 2026-02-26

This document outlines the process for backing up and restoring the Spike Land
database.

## Automated Backups

Database backups are performed automatically on a daily basis using a GitHub
Actions workflow. The workflow is defined in `.github/workflows/backup.yml`.

The backup process consists of the following steps:

1. **Dump the database:** The `pg_dump` command is used to create a SQL dump of
   the database.
2. **Compress the dump:** The SQL dump is compressed using `gzip` to reduce its
   size.
3. **Upload to S3:** The compressed backup file is uploaded to the
   `spike-land-backups` S3 bucket via OIDC authentication.
4. **Apply rotation policy:** Backups older than 30 days are automatically
   deleted.

> **Note**: Backups were previously stored in Cloudflare R2. As part of the AWS
> migration (see [AWS_MIGRATION.md](./architecture/AWS_MIGRATION.md)), backup
> storage has moved to S3 with OIDC-based authentication via
> `AWS_DEPLOY_ROLE_ARN`.

### Configuration

The backup workflow requires the following secrets to be configured in the
GitHub repository's settings:

- `DATABASE_URL`: The connection string for the PostgreSQL database.
- `AWS_DEPLOY_ROLE_ARN`: The IAM role ARN for OIDC authentication to AWS (used
  for S3 access).

**Legacy R2 secrets** (no longer required but may still be configured):

- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

### Monitoring and Alerting

If the backup workflow fails, a new issue will be automatically created in the
GitHub repository.

## Manual Restore

To restore the database from a backup, follow these steps:

1. **Download the backup file:** Download the desired backup file from the S3
   bucket (`spike-land-backups`) or legacy Cloudflare R2 bucket.
2. **Decompress the backup file:** Use the `gunzip` command to decompress the
   backup file:

   ```bash
   gunzip backup-<timestamp>.sql.gz
   ```

3. **Restore the database:** Use the `psql` command to restore the database from
   the decompressed SQL file.

   ```bash
   psql $DATABASE_URL < backup-<timestamp>.sql
   ```

   **Note:** This will overwrite the existing database.

## Troubleshooting

### Backup Workflow Fails with "Missing required environment variables"

**Symptom**: Backup workflow creates an issue with error about missing secrets.

**Cause**: GitHub Secrets for AWS OIDC are not configured or are empty.

**Solution**:

1. Verify `AWS_DEPLOY_ROLE_ARN` secret is configured in GitHub: Settings >
   Secrets and variables > Actions
2. Verify `DATABASE_URL` secret is also configured
3. Trigger a manual workflow run to test: Actions > Database Backup > Run
   workflow

### Backup Workflow Fails with "S3 connectivity check failed"

**Symptom**: Pre-flight checks fail with S3 connectivity errors.

**Cause**: S3 bucket doesn't exist, OIDC role misconfigured, or insufficient IAM
permissions.

**Solution**:

1. Verify the S3 bucket `spike-land-backups` exists in AWS Console
2. Verify the IAM role referenced by `AWS_DEPLOY_ROLE_ARN` has S3 PutObject and
   DeleteObject permissions for the backup bucket
3. Check OIDC trust policy allows GitHub Actions from this repository
4. Test locally (if possible):
   ```bash
   export DATABASE_URL="postgresql://..."
   yarn tsx scripts/backup/backup.ts --dry-run
   ```

### Backup Workflow Fails with "Database connectivity check failed"

**Symptom**: Pre-flight checks fail with database connectivity errors.

**Cause**: Database is unreachable from GitHub Actions runners or DATABASE_URL
is invalid.

**Solution**:

1. Verify `DATABASE_URL` secret is configured correctly
2. Check database firewall rules allow connections from GitHub Actions IPs
3. For cloud databases (Neon, Supabase):
   - Ensure connection pooling is properly configured
   - Verify SSL mode is set correctly (`?sslmode=require`)
4. Test database accessibility from a different environment

### Manual Backup Trigger

To run a backup manually (useful for testing):

1. Go to GitHub repository > Actions
2. Select "Database Backup" workflow
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow" button
6. Monitor the workflow run for errors

### Viewing Backup Files

To access backup files stored in S3:

1. Log into AWS Console: https://console.aws.amazon.com/
2. Navigate to S3
3. Open the `spike-land-backups` bucket
4. Browse or download backup files (named `backup-<timestamp>.sql.gz`)

**Legacy R2 backups** (if still needed):

1. Log into Cloudflare Dashboard: https://dash.cloudflare.com/
2. Navigate to R2 > Overview
3. Click on the backup bucket
