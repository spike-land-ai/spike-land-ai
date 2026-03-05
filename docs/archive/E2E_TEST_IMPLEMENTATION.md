# E2E Test Implementation for Image Enhancement App Features

> **Status (2026-02-26):** The E2E test files referenced in this document
> (`e2e/features/*.feature`, `e2e/step-definitions/*.steps.ts`) were removed
> during the dead code cleanup (~420 files removed). This document is retained
> as an architectural reference for the test design patterns. If E2E tests are
> re-implemented, use the patterns described below.

This document describes the comprehensive E2E tests created for the newly
implemented features in the Image Enhancement App.

## Overview

Created comprehensive E2E test coverage for:

1. Legal Pages (Privacy, Terms, Cookies)
2. Referral System
3. Admin Dashboard
4. Batch Image Operations

## Files Created

### Feature Files (Gherkin/BDD)

#### 1. Legal Pages (`e2e/features/legal-pages.feature`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/features/legal-pages.feature`
- **Size**: 3.0 KB
- **Scenarios**: 15 scenarios covering:
  - Privacy policy page accessibility
  - Terms of service page accessibility
  - Cookie policy page accessibility
  - Legal disclaimers and warnings
  - Table of contents navigation
  - Unauthenticated access (legal pages are public)
  - GDPR rights display
  - Cookie consent banner integration

#### 2. Referral System (`e2e/features/referral-system.feature`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/features/referral-system.feature`
- **Size**: 4.5 KB
- **Tag**: `@requires-db`
- **Scenarios**: 22 scenarios covering:
  - Referral dashboard access control
  - Referral link display and copying
  - Social sharing buttons (Twitter, Facebook, LinkedIn)
  - Referral statistics display
  - Referred users table with different statuses
  - Loading and error states
  - "How It Works" section
  - Empty state handling

#### 3. Admin Dashboard (`e2e/features/admin-dashboard.feature`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/features/admin-dashboard.feature`
- **Size**: 5.5 KB
- **Tag**: `@requires-db`
- **Scenarios**: 30+ scenarios covering:
  - Admin access control (admin vs non-admin vs unauthenticated)
  - Dashboard metrics cards display
  - Quick links navigation
  - Sidebar navigation
  - All admin sub-pages (Analytics, Tokens, System, Vouchers, Users)
  - Layout verification (fixed sidebar, main content)
  - Super admin access

#### 4. Batch Operations (`e2e/features/batch-operations.feature`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/features/batch-operations.feature`
- **Size**: 6.4 KB
- **Tag**: `@requires-db`
- **Scenarios**: 30+ scenarios covering:
  - Batch image upload (multiple files at once)
  - Upload progress tracking (individual and overall)
  - Upload cancellation
  - Mixed success/failure handling
  - File size and type validation
  - Batch enhancement with tier selection
  - Token cost calculation for batches
  - Batch deletion
  - Select all / deselect all functionality
  - Retry failed enhancements
  - Upload limits (20 images max)

### Step Definition Files (TypeScript)

#### 1. Legal Pages Steps (`e2e/step-definitions/legal-pages.steps.ts`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/step-definitions/legal-pages.steps.ts`
- **Size**: 1.9 KB
- **Key Features**:
  - Cookie consent banner manipulation
  - Anchor link navigation testing
  - Viewport scroll verification
  - Uses existing authentication steps from `authentication.steps.ts`

#### 2. Referral Steps (`e2e/step-definitions/referral.steps.ts`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/step-definitions/referral.steps.ts`
- **Size**: 9.8 KB
- **Key Features**:
  - API response mocking for referral data
  - Clipboard testing for copy functionality
  - Social share popup verification
  - Table and badge verification
  - Loading skeleton detection
  - Error alert handling

#### 3. Admin Steps (`e2e/step-definitions/admin.steps.ts`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/step-definitions/admin.steps.ts`
- **Size**: 8.2 KB
- **Key Features**:
  - Admin status mocking
  - Sidebar navigation testing
  - Metric card verification
  - Layout and positioning verification (CSS property checks)
  - Access control testing

#### 4. Batch Operations Steps (`e2e/step-definitions/batch-operations.steps.ts`)

- **Location**:
  `/Users/z/Developer/spike-land-ai/spike.land/e2e/step-definitions/batch-operations.steps.ts`
- **Size**: 22 KB (largest file - comprehensive batch testing)
- **Key Features**:
  - File upload simulation
  - Multi-file selection handling
  - Progress tracking verification
  - Checkbox interaction (select/deselect)
  - Modal dialog interaction
  - Token balance mocking
  - Batch processing status tracking

## Test Patterns Used

### 1. Authentication Helpers

All tests leverage existing authentication helpers from
`e2e/step-definitions/authentication.steps.ts`:

- `I am logged in as "Name" with email "email@example.com"`
- `I am not logged in`
- Session mocking via NextAuth API routes

### 2. API Mocking

Tests use Playwright's route interception to mock backend APIs:

```typescript
await this.page.route('**/api/referral/**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ... }),
  });
});
```

### 3. Data-TestId Attributes

Tests rely on `data-testid` attributes for reliable element selection:

- `data-testid="upload-queue-item"`
- `data-testid="batch-progress"`
- `data-testid="tier-cost"`

### 4. Role-Based Selectors

Uses semantic ARIA roles for accessibility and test reliability:

- `getByRole('button', { name: 'Copy' })`
- `getByRole('link', { name: 'Privacy' })`
- `getByRole('dialog')` for modals

## Running the Tests

### Local Development

```bash
# Start dev server first
npm run dev

# In another terminal, run E2E tests
npm run test:e2e:local
```

### CI Environment

```bash
# Tests run against deployed URL
npm run test:e2e:ci
```

### Run Specific Feature Files

```bash
# Run only legal pages tests
npx cucumber-js e2e/features/legal-pages.feature

# Run only referral tests (requires DB)
npx cucumber-js e2e/features/referral-system.feature

# Run only admin tests (requires DB)
npx cucumber-js e2e/features/admin-dashboard.feature

# Run only batch operations tests (requires DB)
npx cucumber-js e2e/features/batch-operations.feature
```

## Test Tags

### `@requires-db`

Tests that require database setup and real data:

- Referral System
- Admin Dashboard
- Batch Operations

### `@skip`

Temporarily skipped tests (not used in new features)

### `@flaky`

Tests with known flakiness issues (not used in new features)

### `@fast`

Quick-running tests (not explicitly tagged in new features)

## Implementation Notes

### Legal Pages Tests

- **Public Access**: Legal pages are accessible without authentication
- **SEO-Friendly**: Tests verify heading structure and content visibility
- **Navigation**: Tests table of contents anchor links and smooth scrolling

### Referral System Tests

- **Authentication Required**: All scenarios require logged-in user
- **API Mocking**: Extensive use of mocked API responses for different states
- **Social Sharing**: Tests verify popup windows open with correct URLs
- **Statistics**: Validates display of referral counts and token earnings

### Admin Dashboard Tests

- **Role-Based Access**: Tests admin, super admin, and non-admin scenarios
- **Layout Verification**: Uses CSS property checks to verify fixed sidebar
- **Navigation**: Tests all admin sub-pages and quick links
- **Metrics Display**: Validates that numbers are displayed correctly

### Batch Operations Tests

- **File Handling**: Most comprehensive - handles multiple file uploads
- **Progress Tracking**: Individual and batch-level progress indicators
- **Error Handling**: Mixed success/failure scenarios
- **Validation**: File size and type validation
- **Token Economics**: Cost calculation for batch operations
- **User Actions**: Select all, deselect all, retry failed

## Known Limitations

### Clipboard API

Some browsers/test environments may not support
`navigator.clipboard.writeText()`:

- Clipboard tests may need to be skipped in CI
- Alternative: verify button state change instead of actual clipboard content

### File Upload Testing

File upload tests require actual image files in `e2e/fixtures/`:

- Create test images: `test-image-1.jpg`, `test-image-2.jpg`, etc.
- Or mock file input with synthetic File objects

### Database State

Tests tagged with `@requires-db` need proper database seeding:

- User accounts with different roles
- Existing referral data for testing different states
- Token balances for enhancement tests

## Next Steps

### 1. Create Test Fixtures

Create actual test image files:

```bash
mkdir -p e2e/fixtures
# Add test images: test-image-1.jpg, test-image-2.jpg, etc.
```

### 2. Database Seeding

Create database seed scripts for E2E tests:

- Admin users
- Regular users
- Referral relationships
- Token balances

### 3. CI Configuration

Update `.github/workflows/ci-cd.yml` to:

- Set up test database
- Seed test data
- Run E2E tests with `@requires-db` tag

### 4. Test Data Isolation

Implement test data cleanup between runs:

- Reset database to known state
- Clear localStorage/cookies
- Avoid test interference

## Test Coverage Summary

| Feature          | Scenarios | Coverage    |
| ---------------- | --------- | ----------- |
| Legal Pages      | 15        | ✅ Complete |
| Referral System  | 22        | ✅ Complete |
| Admin Dashboard  | 30+       | ✅ Complete |
| Batch Operations | 30+       | ✅ Complete |

**Total Scenarios**: ~97 new E2E test scenarios

## Integration with Existing Tests

These new tests integrate seamlessly with existing E2E infrastructure:

- Uses same `CustomWorld` from `e2e/support/world.ts`
- Follows same pattern as `e2e/features/authentication.feature`
- Reuses authentication helpers
- Compatible with existing Cucumber/Playwright setup

## Resources

- **Cucumber Documentation**: https://cucumber.io/docs/cucumber/
- **Playwright Documentation**: https://playwright.dev/
- **Existing Tests**: See `e2e/features/image-enhancement.feature` for reference
  patterns
- **Step Definitions**: See `e2e/step-definitions/authentication.steps.ts` for
  auth helpers
