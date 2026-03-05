# Campaign Analytics Tracking Integration

This document explains how to integrate the SessionTracker component and
useTracking hook for campaign analytics.

## Overview

The campaign tracking system provides:

- **Session tracking**: Automatic visitor and session management
- **UTM parameter capture**: Captures UTM params on landing (utm_source,
  utm_medium, utm_campaign, etc.)
- **Click ID tracking**: Captures gclid (Google) and fbclid (Facebook) for
  attribution
- **Page view tracking**: Automatic tracking of SPA route changes
- **Scroll depth tracking**: Tracks 25%, 50%, 75%, 100% scroll milestones
- **Time on page tracking**: Tracks 30s, 60s, 180s engagement milestones
- **Conversion tracking**: Manual tracking of signup, enhancement, and purchase
  conversions
- **User linking**: Automatically links anonymous sessions to users on login

## Installation

### Step 1: Add SessionTracker to Layout

Add the `SessionTracker` component to your root layout. It should be placed
inside the `<body>` tag, after the `SessionProvider` from next-auth.

```tsx
// src/app/layout.tsx
import { SessionTracker } from "@/components/tracking";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SessionProvider>
            {/* Add SessionTracker here */}
            <SessionTracker />
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Important Notes:**

- The component must be inside `SessionProvider` to track user authentication
- The component renders nothing (returns null) - no UI impact
- Tracking only occurs if user has accepted cookies
  (`localStorage.getItem("cookie-consent") === "accepted"`)

### Step 2: Use the Tracking Hook

For manual conversion and event tracking, use the `useTracking` hook:

```tsx
"use client";

import { useTracking } from "@/hooks/useTracking";

function SignupButton() {
  const { trackConversion, trackConversionStarted } = useTracking();

  const handleSignupStart = () => {
    // Track when user starts signup flow
    trackConversionStarted("signup");
  };

  const handleSignupComplete = () => {
    // Track successful signup
    trackConversion("signup");
  };

  return (
    <button onClick={handleSignupStart}>
      Sign Up
    </button>
  );
}
```

## API Reference

### SessionTracker Component

The `SessionTracker` component handles all automatic tracking:

| Feature          | Description                                              |
| ---------------- | -------------------------------------------------------- |
| Session creation | Creates a new session on first visit or resumes existing |
| Visitor ID       | Generates and persists a visitor ID in localStorage      |
| UTM capture      | Captures UTM params only on initial landing page         |
| Device info      | Detects device type, browser, and OS                     |
| Page views       | Tracks route changes automatically                       |
| Scroll depth     | Tracks 25%, 50%, 75%, 100% scroll milestones             |
| Time on page     | Tracks 30s, 60s, 180s time milestones                    |
| User linking     | Links session to user ID on authentication               |
| Visibility       | Pauses tracking when tab is hidden                       |

### useTracking Hook

```typescript
const {
  trackEvent,
  trackConversion,
  trackConversionStarted,
  getSessionId,
  getVisitorId,
  isTrackingEnabled,
} = useTracking();
```

#### `trackEvent(name, value?, metadata?)`

Track a whitelisted event.

**Allowed event names:**

- `signup_started`, `signup_completed`
- `enhancement_started`, `enhancement_completed`
- `purchase_started`, `purchase_completed`
- `page_scroll_25`, `page_scroll_50`, `page_scroll_75`, `page_scroll_100`
- `time_on_page_30s`, `time_on_page_60s`, `time_on_page_180s`

```typescript
// Track an event with value
trackEvent("enhancement_completed", 5); // 5 tokens used

// Track an event with metadata
trackEvent("signup_completed", undefined, { method: "google" });
```

#### `trackConversion(type, value?)`

Track a completed conversion.

```typescript
// Track a signup completion
trackConversion("signup");

// Track a purchase with value
trackConversion("purchase", 29.99);

// Track enhancement completion with token cost
trackConversion("enhancement", 5);
```

#### `trackConversionStarted(type)`

Track the start of a conversion funnel.

```typescript
// User starts signup flow
trackConversionStarted("signup");

// User starts enhancement
trackConversionStarted("enhancement");

// User starts checkout
trackConversionStarted("purchase");
```

#### `getSessionId()` / `getVisitorId()`

Get the current session/visitor IDs.

```typescript
const sessionId = getSessionId(); // From sessionStorage
const visitorId = getVisitorId(); // From localStorage
```

#### `isTrackingEnabled()`

Check if tracking is enabled (consent given and session active).

```typescript
if (isTrackingEnabled()) {
  // Tracking is active
}
```

## Privacy and Consent

The tracking system respects user privacy:

1. **Cookie Consent Required**: No tracking occurs unless
   `localStorage.getItem("cookie-consent") === "accepted"`
2. **No PII Collection**: Only anonymous visitor IDs, no personal data
3. **Session-based**: Session IDs are stored in sessionStorage (cleared on tab
   close)
4. **Visitor IDs**: Stored in localStorage for returning visitor recognition

## Database Schema

Tracking data is stored in these tables:

- `visitor_sessions`: Session data with UTM params and device info
- `page_views`: Individual page views within sessions
- `analytics_events`: Custom events (scroll, time, conversions)
- `campaign_attribution`: Links users to campaigns for ROI tracking

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for full schema details.

## API Endpoints

The tracking system uses these endpoints:

| Endpoint                 | Method | Description                          |
| ------------------------ | ------ | ------------------------------------ |
| `/api/tracking/session`  | POST   | Create a new session                 |
| `/api/tracking/session`  | PATCH  | Update session (end time, user link) |
| `/api/tracking/pageview` | POST   | Record a page view                   |
| `/api/tracking/event`    | POST   | Record a custom event                |

All endpoints are rate-limited and validate input with Zod schemas.

## Troubleshooting

### Tracking not working

1. Check cookie consent: `localStorage.getItem("cookie-consent")` should be
   `"accepted"`
2. Check session exists: `sessionStorage.getItem("spike_session_id")` should
   have a value
3. Check browser console for `[Tracking]` warnings

### Events not being recorded

1. Ensure event name is in the whitelist (see allowed events above)
2. Check the API response in Network tab
3. Verify session ID is valid

### UTM params not captured

UTM params are only captured on the initial landing page. Subsequent SPA
navigations do not re-capture params. This prevents overwriting the original
attribution source.
