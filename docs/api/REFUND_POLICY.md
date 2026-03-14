# Token Refund Policy

## Overview

Spike Land's image enhancement system uses tokens for AI-powered image
processing. This document explains the refund policy for failed enhancements.

## Automatic Refunds

### When Refunds Occur

1. **Workflow Start Failure**: If the enhancement workflow fails to start,
   tokens are refunded immediately.

2. **Processing Failure**: If the Gemini AI service encounters an error during
   enhancement:
   - Service errors (not user errors) trigger automatic refunds
   - Refunds are processed within 24 hours per our Terms of Service

3. **Batch Enhancement**: For batch operations:
   - Each image is processed independently
   - Failed images receive individual refunds
   - Successful images consume tokens as expected

### What Doesn't Qualify for Refund

- User cancellation after processing has started
- Images that fail validation (wrong format, too large)
- Network issues on the user's side

## Technical Implementation

### Single Enhancement

- Tokens consumed upfront via `TokenBalanceManager.consumeTokens()`
- On failure: `TokenBalanceManager.refundTokens()` called automatically
- Transaction logged in `TokenTransaction` with type `REFUND_ENHANCEMENT`

### Parallel Enhancement

- Total cost for all tiers consumed atomically in a single transaction
- Per-job refunds if individual tier processing fails
- Refund tracking includes tier and job ID for auditing

### Batch Enhancement

- Tokens consumed per-image
- Failed images refunded individually
- Batch continues even if some images fail

## Monitoring

Refund operations are logged with:

- User ID
- Job ID
- Token amount
- Failure reason
- Timestamp

Administrators can view refund metrics in the Admin Dashboard under Token
Economy analytics.

## Contact

For refund inquiries not handled automatically, contact hello@spike.land with:

- Your account email
- Job ID (visible in enhancement history)
- Description of the issue
