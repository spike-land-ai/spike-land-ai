# Manual Testing Guide - Image Enhancement App

**Version:** Phase 3-5 Release **Environment:** https://spike.land **Last
Updated:** 2026-02-26

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Account Setup](#test-account-setup)
3. [Feature Test Cases](#feature-test-cases)
   - [Authentication](#1-authentication)
   - [Image Upload & Enhancement](#2-image-upload--enhancement)
   - [Token System](#3-token-system)
   - [Albums & Organization](#4-albums--organization)
   - [Batch Operations](#5-batch-operations)
   - [Version History](#6-version-history)
   - [Export Functionality](#7-export-functionality)
   - [Referral System](#8-referral-system)
   - [Admin Dashboard](#9-admin-dashboard)
   - [Legal Pages](#10-legal-pages)
4. [Regression Tests](#regression-tests)
5. [Bug Reporting Template](#bug-reporting-template)

---

## Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- GitHub or Google account for authentication
- Test images (JPEG, PNG, WebP) of various sizes
- Access to email for referral testing

---

## Test Account Setup

### Creating a Test Account

1. Navigate to https://spike.land
2. Click "Sign In" button
3. Choose authentication provider (GitHub or Google)
4. Complete OAuth flow
5. Verify redirect to dashboard

### Initial Token Balance

- New users receive **10 free tokens**
- Tokens auto-regenerate at **1 token per 15 minutes** (up to 10 max)

---

## Feature Test Cases

### 1. Authentication

#### TC-AUTH-001: Sign In with GitHub

| Step | Action                       | Expected Result                 |
| ---- | ---------------------------- | ------------------------------- |
| 1    | Click "Sign In"              | Sign-in page appears            |
| 2    | Click "Continue with GitHub" | Redirect to GitHub OAuth        |
| 3    | Authorize application        | Redirect back to app            |
| 4    | Verify user info             | Name/avatar displayed in header |

#### TC-AUTH-002: Sign In with Google

| Step | Action                       | Expected Result                 |
| ---- | ---------------------------- | ------------------------------- |
| 1    | Click "Sign In"              | Sign-in page appears            |
| 2    | Click "Continue with Google" | Redirect to Google OAuth        |
| 3    | Select Google account        | Redirect back to app            |
| 4    | Verify user info             | Name/avatar displayed in header |

#### TC-AUTH-003: Sign Out

| Step | Action                 | Expected Result                 |
| ---- | ---------------------- | ------------------------------- |
| 1    | Click user avatar      | Dropdown menu appears           |
| 2    | Click "Sign Out"       | Session ends                    |
| 3    | Verify redirect        | Return to home page             |
| 4    | Check protected routes | Redirect to sign-in if accessed |

#### TC-AUTH-004: Session Persistence

| Step | Action                | Expected Result        |
| ---- | --------------------- | ---------------------- |
| 1    | Sign in successfully  | User authenticated     |
| 2    | Close browser tab     | -                      |
| 3    | Reopen app in new tab | Session still active   |
| 4    | Refresh page          | User remains signed in |

---

### 2. Image Upload & Enhancement

#### TC-IMG-001: Single Image Upload

| Step | Action                            | Expected Result                  |
| ---- | --------------------------------- | -------------------------------- |
| 1    | Navigate to /apps/pixel           | Enhancement page loads           |
| 2    | Drag & drop image OR click upload | File dialog opens                |
| 3    | Select JPEG image (<10MB)         | Image preview appears            |
| 4    | Verify upload progress            | Progress bar shown               |
| 5    | Check image details               | Name, size, dimensions displayed |

#### TC-IMG-002: Image Format Support

| Format             | Expected Result    |
| ------------------ | ------------------ |
| JPEG (.jpg, .jpeg) | Upload successful  |
| PNG (.png)         | Upload successful  |
| WebP (.webp)       | Upload successful  |
| GIF (.gif)         | Should be rejected |
| BMP (.bmp)         | Should be rejected |

#### TC-IMG-003: Enhancement Tiers

| Tier | Resolution | Token Cost | Expected Result         |
| ---- | ---------- | ---------- | ----------------------- |
| 1K   | 1024px     | 2 tokens   | Faster, preview quality |
| 2K   | 2048px     | 5 tokens   | Balanced quality        |
| 4K   | 4096px     | 10 tokens  | Maximum quality         |

#### TC-IMG-004: Enhancement Process

| Step | Action                 | Expected Result                 |
| ---- | ---------------------- | ------------------------------- |
| 1    | Upload image           | Image ready for enhancement     |
| 2    | Select tier (e.g., 2K) | Tier highlighted, cost shown    |
| 3    | Click "Enhance"        | Processing starts               |
| 4    | Observe progress       | Status indicator shows progress |
| 5    | Wait for completion    | Enhanced image displayed        |
| 6    | Compare before/after   | Slider allows comparison        |

#### TC-IMG-005: Download Enhanced Image

| Step | Action                 | Expected Result               |
| ---- | ---------------------- | ----------------------------- |
| 1    | Complete enhancement   | Enhanced image visible        |
| 2    | Click "Download"       | Download dialog appears       |
| 3    | Verify downloaded file | File matches expected quality |

---

### 3. Token System

#### TC-TOK-001: View Token Balance

| Step | Action              | Expected Result         |
| ---- | ------------------- | ----------------------- |
| 1    | Sign in             | User authenticated      |
| 2    | Check header        | Token balance displayed |
| 3    | Navigate to profile | Detailed balance shown  |

#### TC-TOK-002: Token Deduction

| Step | Action                  | Expected Result       |
| ---- | ----------------------- | --------------------- |
| 1    | Note current balance    | e.g., 10 tokens       |
| 2    | Enhance image (2K tier) | Enhancement completes |
| 3    | Check new balance       | Balance reduced by 5  |

#### TC-TOK-003: Insufficient Tokens

| Step | Action                     | Expected Result                |
| ---- | -------------------------- | ------------------------------ |
| 1    | Ensure balance < tier cost | e.g., 3 tokens, select 4K (10) |
| 2    | Try to enhance             | Error message displayed        |
| 3    | Verify no deduction        | Balance unchanged              |

#### TC-TOK-004: Token Auto-Regeneration

| Step | Action                    | Expected Result          |
| ---- | ------------------------- | ------------------------ |
| 1    | Use tokens (balance < 10) | e.g., 5 tokens remaining |
| 2    | Wait 15 minutes           | Balance increases by 1   |
| 3    | Wait until balance = 10   | No further regeneration  |

#### TC-TOK-005: Purchase Tokens

| Step | Action                | Expected Result       |
| ---- | --------------------- | --------------------- |
| 1    | Click "Buy Tokens"    | Pricing modal appears |
| 2    | Select package        | Stripe checkout opens |
| 3    | Complete test payment | Redirect back to app  |
| 4    | Verify token credit   | Balance increased     |

**Test Card for Stripe:** `4242 4242 4242 4242` (any future date, any CVC)

---

### 4. Albums & Organization

#### TC-ALB-001: Create Album

| Step | Action                     | Expected Result       |
| ---- | -------------------------- | --------------------- |
| 1    | Navigate to /apps/pixel    | Albums page loads     |
| 2    | Click "Create Album"       | Create dialog appears |
| 3    | Enter album name           | Name accepted         |
| 4    | Add description (optional) | Description saved     |
| 5    | Click "Create"             | Album appears in list |

#### TC-ALB-002: Add Images to Album

| Step | Action                 | Expected Result          |
| ---- | ---------------------- | ------------------------ |
| 1    | Open album             | Album detail view        |
| 2    | Click "Add Images"     | Upload interface appears |
| 3    | Upload multiple images | Images added to album    |
| 4    | Verify image count     | Count matches uploads    |

#### TC-ALB-003: Edit Album

| Step | Action                  | Expected Result   |
| ---- | ----------------------- | ----------------- |
| 1    | Open album              | Album detail view |
| 2    | Click "Edit"            | Edit mode enabled |
| 3    | Change name/description | Changes reflected |
| 4    | Save changes            | Album updated     |

#### TC-ALB-004: Delete Album

| Step | Action           | Expected Result            |
| ---- | ---------------- | -------------------------- |
| 1    | Open album       | Album detail view          |
| 2    | Click "Delete"   | Confirmation dialog        |
| 3    | Confirm deletion | Album removed              |
| 4    | Verify images    | Images orphaned or deleted |

#### TC-ALB-005: Share Album (Unlisted Link)

| Step | Action                 | Expected Result             |
| ---- | ---------------------- | --------------------------- |
| 1    | Open album             | Album detail view           |
| 2    | Click "Share"          | Share options appear        |
| 3    | Copy unlisted link     | Link copied to clipboard    |
| 4    | Open link in incognito | Album viewable without auth |

---

### 5. Batch Operations

#### TC-BAT-001: Batch Upload

| Step | Action                            | Expected Result         |
| ---- | --------------------------------- | ----------------------- |
| 1    | Navigate to batch upload          | Batch interface loads   |
| 2    | Select multiple images (up to 20) | All images queued       |
| 3    | Verify total size < 50MB          | Upload accepted         |
| 4    | Start upload                      | Progress for each image |
| 5    | Verify all uploaded               | All images in gallery   |

#### TC-BAT-002: Batch Upload Limits

| Test Case               | Expected Result       |
| ----------------------- | --------------------- |
| Upload 21 images        | Error: Max 20 images  |
| Upload 60MB total       | Error: Max 50MB total |
| Upload 19 images (49MB) | Success               |

#### TC-BAT-003: Batch Enhancement

| Step | Action                  | Expected Result              |
| ---- | ----------------------- | ---------------------------- |
| 1    | Select multiple images  | Images selected (checkboxes) |
| 2    | Choose enhancement tier | Tier applied to all          |
| 3    | Verify total cost       | Cost = images x tier cost    |
| 4    | Start batch enhancement | Queue processing begins      |
| 5    | Monitor progress        | Individual progress shown    |
| 6    | Wait for completion     | All images enhanced          |

#### TC-BAT-004: Batch Enhancement Limits

| Test Case                        | Expected Result                |
| -------------------------------- | ------------------------------ |
| Select 21 images for enhancement | Error: Max 20 images per batch |
| Insufficient tokens for batch    | Error shown before processing  |

---

### 6. Version History

#### TC-VER-001: View Version History

| Step | Action                  | Expected Result              |
| ---- | ----------------------- | ---------------------------- |
| 1    | Open enhanced image     | Image detail view            |
| 2    | Click "Version History" | History panel opens          |
| 3    | See list of versions    | Original + enhanced versions |

#### TC-VER-002: Compare Versions

| Step | Action                | Expected Result         |
| ---- | --------------------- | ----------------------- |
| 1    | Open version history  | History panel visible   |
| 2    | Select two versions   | Both versions loaded    |
| 3    | Use comparison slider | Side-by-side comparison |

#### TC-VER-003: Revert to Previous Version

| Step | Action               | Expected Result             |
| ---- | -------------------- | --------------------------- |
| 1    | Open version history | History panel visible       |
| 2    | Select older version | Version preview shown       |
| 3    | Click "Restore"      | Confirmation dialog         |
| 4    | Confirm restore      | Version restored as current |

---

### 7. Export Functionality

#### TC-EXP-001: Export Formats

| Format | Steps               | Expected Result       |
| ------ | ------------------- | --------------------- |
| JPEG   | Select JPEG, export | .jpg file downloaded  |
| PNG    | Select PNG, export  | .png file downloaded  |
| WebP   | Select WebP, export | .webp file downloaded |

#### TC-EXP-002: Export Quality Settings

| Step | Action                 | Expected Result             |
| ---- | ---------------------- | --------------------------- |
| 1    | Open export dialog     | Format options shown        |
| 2    | Select JPEG format     | Quality slider appears      |
| 3    | Adjust quality (0-100) | Preview updates             |
| 4    | Export at 80% quality  | File size smaller than 100% |

---

### 8. Referral System

#### TC-REF-001: Generate Referral Link

| Step | Action                 | Expected Result          |
| ---- | ---------------------- | ------------------------ |
| 1    | Navigate to /referrals | Referral page loads      |
| 2    | View referral link     | Unique link displayed    |
| 3    | Copy link              | Link copied to clipboard |

#### TC-REF-002: Referral Sign-up

| Step | Action                        | Expected Result               |
| ---- | ----------------------------- | ----------------------------- |
| 1    | Open referral link (new user) | Sign-up page with attribution |
| 2    | Complete sign-up              | New account created           |
| 3    | Verify referral tracked       | Shown in referrer's dashboard |

#### TC-REF-003: Referral Rewards

| Step | Action                    | Expected Result                |
| ---- | ------------------------- | ------------------------------ |
| 1    | Referee completes sign-up | Referral tracked               |
| 2    | Referee verifies email    | Fraud checks pass              |
| 3    | Check referrer balance    | +50 tokens credited            |
| 4    | Check referee balance     | +50 tokens (on top of initial) |

#### TC-REF-004: Fraud Prevention

| Test Case                         | Expected Result |
| --------------------------------- | --------------- |
| Self-referral (same account)      | Rejected        |
| Disposable email (mailinator.com) | Rejected        |
| Same IP within 24 hours           | Rejected        |
| More than 10 referrals/day        | Rate limited    |

---

### 9. Admin Dashboard

**Note:** Requires ADMIN or SUPER_ADMIN role

#### TC-ADM-001: Access Admin Dashboard

| Step | Action             | Expected Result            |
| ---- | ------------------ | -------------------------- |
| 1    | Sign in as admin   | Admin badge visible        |
| 2    | Navigate to /admin | Dashboard loads            |
| 3    | View analytics     | User/token stats displayed |

#### TC-ADM-002: User Management

| Step | Action               | Expected Result           |
| ---- | -------------------- | ------------------------- |
| 1    | Search for user      | User found by email/name  |
| 2    | View user details    | Profile, balance, history |
| 3    | Adjust token balance | Balance updated           |
| 4    | Change user role     | Role updated              |

#### TC-ADM-003: Role Change Restrictions

| Test Case                     | Expected Result               |
| ----------------------------- | ----------------------------- |
| Admin demotes themselves      | Error: Cannot demote yourself |
| Admin promotes to SUPER_ADMIN | Error: Only super admins can  |
| Admin demotes SUPER_ADMIN     | Error: Only super admins can  |

#### TC-ADM-004: Token Adjustment Limits

| Test Case           | Expected Result                  |
| ------------------- | -------------------------------- |
| Add 10,000 tokens   | Success                          |
| Add 15,000 tokens   | Error: Max 10,000 per adjustment |
| Remove 1,000 tokens | Success                          |
| Remove 5,000 tokens | Error: Max 1,000 removal         |

#### TC-ADM-005: Create Voucher

| Step | Action                  | Expected Result         |
| ---- | ----------------------- | ----------------------- |
| 1    | Navigate to vouchers    | Voucher management page |
| 2    | Click "Create Voucher"  | Create dialog           |
| 3    | Set code, value, expiry | Voucher created         |
| 4    | Verify voucher in list  | Voucher appears         |

---

### 10. Legal Pages

#### TC-LEG-001: Terms of Service

| Step | Action                  | Expected Result          |
| ---- | ----------------------- | ------------------------ |
| 1    | Navigate to /terms      | Terms page loads         |
| 2    | Verify content          | Complete terms displayed |
| 3    | Check last updated date | Date visible             |

#### TC-LEG-002: Privacy Policy

| Step | Action               | Expected Result                |
| ---- | -------------------- | ------------------------------ |
| 1    | Navigate to /privacy | Privacy page loads             |
| 2    | Verify content       | Complete policy displayed      |
| 3    | Check sections       | Data collection, usage, rights |

#### TC-LEG-003: Cookie Policy

| Step | Action               | Expected Result        |
| ---- | -------------------- | ---------------------- |
| 1    | Navigate to /cookies | Cookie page loads      |
| 2    | Verify content       | Cookie types explained |

---

### 11. Error Boundary Testing

The application has 16 `error.tsx` files providing error boundaries across route
segments (8 under `src/app/`, 8 in deeper nested routes). Additionally, 23
`loading.tsx` files provide loading state fallbacks (11 under `src/app/`, 12
elsewhere).

#### TC-ERR-001: Error Boundary Rendering

| Step | Action                                | Expected Result                        |
| ---- | ------------------------------------- | -------------------------------------- |
| 1    | Navigate to a route with error.tsx    | Page loads normally                    |
| 2    | Trigger a runtime error (if possible) | Error boundary catches and displays UI |
| 3    | Check "Try again" / reset button      | Page recovers without full reload      |

#### TC-ERR-002: Loading State Rendering

| Step | Action                               | Expected Result                   |
| ---- | ------------------------------------ | --------------------------------- |
| 1    | Navigate to a route with loading.tsx | Loading skeleton/spinner appears  |
| 2    | Wait for data to load                | Loading state replaced by content |
| 3    | Throttle network in DevTools         | Loading state visible for longer  |

#### Error Boundary Coverage

| Location               | error.tsx | loading.tsx |
| ---------------------- | --------- | ----------- |
| `src/app/` (top-level) | 8         | 11          |
| Nested routes          | 8         | 12          |
| **Total**              | **16**    | **23**      |

**Key routes with error boundaries:**

- `/admin/*` - Admin dashboard sections
- `/apps/*` - First-party app routes
- `/orbit/*` - Workspace routes
- `/store` - App store
- `/my-apps` - User app builder

---

## Regression Tests

Run these after any deployment to ensure core functionality:

| #  | Test                    | Priority |
| -- | ----------------------- | -------- |
| 1  | Sign in with GitHub     | Critical |
| 2  | Upload single image     | Critical |
| 3  | Enhance image (2K tier) | Critical |
| 4  | Download enhanced image | Critical |
| 5  | View token balance      | High     |
| 6  | Create album            | High     |
| 7  | Batch upload (5 images) | Medium   |
| 8  | View version history    | Medium   |
| 9  | Access referral page    | Low      |
| 10 | View legal pages        | Low      |

---

## Bug Reporting Template

When reporting bugs, please include:

```
### Bug Report

**Summary:** [One-line description]

**Environment:**
- Browser: [Chrome/Firefox/Safari/Edge + version]
- OS: [Windows/macOS/Linux/iOS/Android]
- Device: [Desktop/Mobile/Tablet]
- URL: https://spike.land

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Videos:**
[Attach if applicable]

**Console Errors:**
[Open browser DevTools > Console tab]

**Additional Context:**
[Any other relevant information]
```

---

## Test Environment Notes

- **Production URL:** https://spike.land
- **Test Stripe Cards:**
  - Success: `4242 4242 4242 4242`
  - Decline: `4000 0000 0000 0002`
  - Requires Auth: `4000 0025 0000 3155`
- **Disposable Email Domains (blocked):** mailinator.com, tempmail.com,
  guerrillamail.com, etc.

---

## Sign-off

| Tester | Date | Version | Status |
| ------ | ---- | ------- | ------ |
|        |      |         |        |

---

_Document maintained by the Spike Land team. For questions, contact the
development team._
