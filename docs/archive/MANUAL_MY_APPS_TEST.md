# Manual /my-apps Testing Guide

This document provides a step-by-step guide to manually test the `/my-apps`
functionality both locally and on production.

## Prerequisites

### Local Testing

1. **Start the development server:**
   ```bash
   yarn dev
   ```

2. **Start the local agent polling service:**
   ```bash
   yarn agent:poll
   ```

3. **Open Chrome and navigate to:**
   ```
   http://localhost:3000/my-apps
   ```

### Production Testing

1. **Ensure production agent polling is running:**
   ```bash
   yarn agent:poll:prod
   ```

2. **Open Chrome and navigate to:**
   ```
   https://spike.land/my-apps
   ```

3. **Log in** if required

## Test Apps to Create

Create the following 5 apps to thoroughly test the system:

### 1. Todo List App

**Prompt:**

```
Create a simple todo list app with add, delete, and mark as complete functionality. Use colorful gradient backgrounds.
```

**Expected Features:**

- Input field to add new todos
- Delete button for each todo
- Checkbox to mark complete
- Colorful UI with gradients

**Verification Checklist:**

- [ ] Agent responds within 60 seconds
- [ ] Preview URL appears in agent message
- [ ] Preview loads without errors
- [ ] App functionality works as expected
- [ ] Code is visible in agent response

### 2. Color Picker Tool

**Prompt:**

```
Build a color picker tool that shows hex and RGB values. Include a large color preview and copy buttons for both formats.
```

**Expected Features:**

- Color input/picker
- Display hex value
- Display RGB value
- Copy to clipboard buttons
- Large color preview area

**Verification Checklist:**

- [ ] Agent responds within 60 seconds
- [ ] Preview URL appears in agent message
- [ ] Preview loads without errors
- [ ] App functionality works as expected
- [ ] Code is visible in agent response

### 3. Countdown Timer

**Prompt:**

```
Make a countdown timer with start, pause, reset buttons, and a custom time input. Make it visually appealing with animations.
```

**Expected Features:**

- Input for custom time
- Start button
- Pause button
- Reset button
- Visual countdown display
- Animations when timer runs

**Verification Checklist:**

- [ ] Agent responds within 60 seconds
- [ ] Preview URL appears in agent message
- [ ] Preview loads without errors
- [ ] App functionality works as expected
- [ ] Code is visible in agent response

### 4. Random Quote Generator

**Prompt:**

```
Create a random quote generator with different categories (inspiration, wisdom, humor). Show the quote and author with a beautiful card design.
```

**Expected Features:**

- Random quote display
- Author attribution
- Category selection
- Generate new quote button
- Beautiful card UI

**Verification Checklist:**

- [ ] Agent responds within 60 seconds
- [ ] Preview URL appears in agent message
- [ ] Preview loads without errors
- [ ] App functionality works as expected
- [ ] Code is visible in agent response

### 5. Simple Calculator

**Prompt:**

```
Build a calculator with basic math operations (add, subtract, multiply, divide). Include a clear button and display for the calculation.
```

**Expected Features:**

- Number buttons (0-9)
- Operation buttons (+, -, *, /)
- Equals button
- Clear button
- Display area
- Working calculations

**Verification Checklist:**

- [ ] Agent responds within 60 seconds
- [ ] Preview URL appears in agent message
- [ ] Preview loads without errors
- [ ] App functionality works as expected
- [ ] Code is visible in agent response

## Critical Features to Verify

For EACH app created, verify:

1. **Agent Response Quality**
   - [ ] Agent acknowledges the request
   - [ ] Agent provides code implementation
   - [ ] Response is formatted correctly (markdown)
   - [ ] No error messages in agent response

2. **Preview Functionality**
   - [ ] Preview URL is displayed in format:
         `https://testing.spike.land/live/[codespace-id]/`
   - [ ] Preview URL is clickable
   - [ ] Preview opens in new tab/window
   - [ ] Preview loads without console errors
   - [ ] Preview matches requested functionality

3. **Chat Interface**
   - [ ] Messages appear in correct order
   - [ ] User messages have proper styling
   - [ ] Agent messages have proper styling
   - [ ] Timestamps are visible
   - [ ] Chat is scrollable

4. **App Status**
   - [ ] App status changes from WAITING → DRAFTING → BUILDING → LIVE
   - [ ] Status is visible in UI
   - [ ] Agent progress indicator works

5. **Navigation**
   - [ ] Can navigate back to /my-apps
   - [ ] Created app appears in the app list
   - [ ] Can re-open the app from the list
   - [ ] Chat history is preserved

## Common Issues to Watch For

### Local Testing

- [ ] Agent polling service is running
- [ ] Development server is running on port 3000
- [ ] No database connection errors
- [ ] Cloudflare worker is accessible

### Production Testing

- [ ] Logged in with valid account
- [ ] Agent polling service is running (check logs)
- [ ] No CORS errors in console
- [ ] Preview URLs use `testing.spike.land` domain

## Reporting Results

After testing both local and production environments, document:

### Environment: LOCAL

**Date:** [Fill in] **Agent Poll Process:** [Running/Not Running]

| App # | Prompt          | Agent Response | Preview Works | Issues |
| ----- | --------------- | -------------- | ------------- | ------ |
| 1     | Todo List       | ✅/❌          | ✅/❌         | Notes  |
| 2     | Color Picker    | ✅/❌          | ✅/❌         | Notes  |
| 3     | Countdown Timer | ✅/❌          | ✅/❌         | Notes  |
| 4     | Quote Generator | ✅/❌          | ✅/❌         | Notes  |
| 5     | Calculator      | ✅/❌          | ✅/❌         | Notes  |

**Overall Status:** [Pass/Fail] **Notes:**

---

### Environment: PRODUCTION

**Date:** [Fill in] **Agent Poll Process:** [Running/Not Running]

| App # | Prompt          | Agent Response | Preview Works | Issues |
| ----- | --------------- | -------------- | ------------- | ------ |
| 1     | Todo List       | ✅/❌          | ✅/❌         | Notes  |
| 2     | Color Picker    | ✅/❌          | ✅/❌         | Notes  |
| 3     | Countdown Timer | ✅/❌          | ✅/❌         | Notes  |
| 4     | Quote Generator | ✅/❌          | ✅/❌         | Notes  |
| 5     | Calculator      | ✅/❌          | ✅/❌         | Notes  |

**Overall Status:** [Pass/Fail] **Notes:**

---

## Differences Between Local and Production

Document any differences found:

- Response times
- UI differences
- Feature availability
- Error rates
- Preview loading times

## Recommendations

Based on testing, provide recommendations for:

- Performance improvements
- UI/UX enhancements
- Error handling
- Agent response quality
- Preview reliability
