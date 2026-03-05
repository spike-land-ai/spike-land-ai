# Testing Strategy

Comprehensive guide to the testing infrastructure, conventions, and best
practices for the Spike Land platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Pyramid](#test-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Coverage Requirements](#coverage-requirements)
7. [Test Commands](#test-commands)
8. [File Naming Conventions](#file-naming-conventions)
9. [Writing Tests](#writing-tests)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

| Aspect           | Technology                             |
| ---------------- | -------------------------------------- |
| Unit Testing     | Vitest + React Testing Library         |
| E2E Testing      | Playwright + Cucumber (BDD)            |
| Coverage         | V8 provider, thresholds enforced in CI |
| CI Pipeline      | GitHub Actions with sharding           |
| Test Environment | jsdom for unit, Chromium for E2E       |

### Current Test Statistics (Updated 2026-02-26)

- **398 test files** across the codebase (reduced from ~1,034 after dead code
  removal of ~420 files)
- **147 MCP tool files** with **150 MCP test files** (100%+ file coverage)
- Coverage thresholds enforced in CI pipeline on MCP business logic

---

## Test Pyramid

We follow the testing pyramid principle to balance test coverage, speed, and
maintenance costs.

```
       /\
      /  \
     / E2E \       (5% - Critical User Flows)
    /------\
   /        \
  /Integration\ (15% - Component Interactions)
 /            \
/   Unit Tests\  (80% - Individual Functions/Components)
/______________\
```

### Unit Tests (80%)

- **Purpose**: Test individual functions, hooks, and components in isolation
- **Location**: Alongside source files (`*.test.ts`, `*.test.tsx`)
- **Tools**: Vitest, React Testing Library
- **Speed**: Fast (milliseconds per test)
- **Run command**: `yarn test` or `yarn test:coverage`

### Integration Tests (15%)

- **Purpose**: Test interactions between multiple components or services
- **Location**: Same as unit tests
- **Examples**: API routes with mocked database, auth flows, form submissions
- **Run command**: Same as unit tests

### E2E Tests (5%)

- **Purpose**: Validate complete user workflows in a real browser
- **Location**: `e2e/features/*.feature`, `e2e/step-definitions/*.steps.ts`
- **Tools**: Playwright + Cucumber
- **Speed**: Slow (seconds per scenario)
- **Run command**: `yarn test:e2e:local`

---

## Unit Testing

### Configuration

Unit tests are configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks", // Better memory isolation in CI
    fileParallelism: true,
    include: ["src/lib/mcp/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/mcp/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

> **Note:** Coverage thresholds are enforced on MCP business logic
> (`src/lib/mcp/**/*.ts`) only, not on the entire codebase. All business logic
> is exposed and tested via MCP tools.

### Test Setup

The `vitest.setup.ts` file configures the test environment:

- Extends Jest DOM matchers for assertions
- Polyfills for jsdom (pointer capture, scrollIntoView, ResizeObserver)
- Mocks for `window.matchMedia` (required by next-themes)
- Cleanup after each test with React Testing Library
- Console suppression during tests

### Example: Testing a Utility Function

```typescript
import { describe, expect, it } from "vitest";
import { cn, formatFileSize } from "./utils";

describe("cn utility function", () => {
  it("should merge class names correctly", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("should handle conditional classes", () => {
    const result = cn("base-class", true && "conditional-true");
    expect(result).toBe("base-class conditional-true");
  });
});
```

### Example: Testing a React Component

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("should render input element", () => {
    render(<Input data-testid="test-input" />);
    expect(screen.getByTestId("test-input")).toBeInTheDocument();
  });

  it("should handle disabled state", () => {
    render(<Input disabled data-testid="disabled-input" />);
    expect(screen.getByTestId("disabled-input")).toBeDisabled();
  });

  it("should forward ref", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
```

### Example: Testing an API Route

```typescript
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Health Check API", () => {
  it("should return 200 status with ok message", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });

  it("should return JSON response with correct content-type", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
```

---

## Integration Testing

Integration tests verify that multiple components work together correctly. They
are structured the same as unit tests but test larger pieces of functionality.

### Mocking External Services

Use Vitest mocks for external dependencies:

```typescript
import { vi } from "vitest";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ id: 1, name: "Test User" }),
  } as Response)
);
```

### Testing with Database Mocks

For unit tests, always mock the Prisma client:

```typescript
import { prisma } from "@/lib/prisma";
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      }),
    },
  },
}));
```

---

## E2E Testing

E2E tests use Playwright with Cucumber for BDD-style specifications.

### Configuration

E2E tests are configured in `cucumber.js` with multiple profiles:

| Profile    | Purpose                              | Tags                                                         |
| ---------- | ------------------------------------ | ------------------------------------------------------------ |
| `default`  | Standard E2E tests                   | `not @skip and not @flaky and not @requires-db and not @wip` |
| `fast`     | Quick smoke tests                    | `@fast and not @skip and not @flaky`                         |
| `slow`     | Comprehensive integration tests      | `@slow and not @skip`                                        |
| `flaky`    | Known flaky tests (run with retries) | `@flaky and not @skip`                                       |
| `ci`       | CI-specific configuration            | `not @skip and not @flaky and not @requires-db and not @wip` |
| `local`    | Local development                    | `not @skip and not @flaky and not @requires-db`              |
| `db`       | Database-dependent tests             | `@requires-db and not @skip and not @flaky`                  |
| `coverage` | Collect coverage during E2E          | `not @skip and not @flaky and not @requires-db`              |

### E2E Tags

Use tags to categorize and control test execution:

| Tag                  | Purpose                            |
| -------------------- | ---------------------------------- |
| `@skip`              | Temporarily skip this scenario     |
| `@flaky`             | Known flaky test, run with retries |
| `@fast`              | Quick test for smoke testing       |
| `@slow`              | Slow, comprehensive test           |
| `@requires-db`       | Requires seeded database           |
| `@wip`               | Work in progress, not ready for CI |
| `@requires-api-mock` | Requires API mocking               |

### Example: Feature File

```gherkin
Feature: Landing Page - CTA and Feature Cards
  As a visitor to the site
  I want to interact with the landing page elements
  So that I can navigate to relevant sections

  Background:
    Given I am not logged in

  @fast
  Scenario: Landing page displays main CTA button
    When I visit "/"
    Then the page should load successfully
    And I should see the primary CTA button

  @fast
  Scenario: Landing page CTA button navigates to sign-in
    When I visit "/"
    And I click the primary CTA button
    Then I should be redirected to sign-in page

  @fast @requires-db
  Scenario: Authenticated users can view landing page
    Given I am logged in as "Test User" with email "test@example.com"
    When I visit "/"
    Then the page should load successfully
```

### Example: Step Definition

```typescript
import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { CustomWorld } from "../support/world";

When(
  "I click {string} button",
  async function (this: CustomWorld, buttonText: string) {
    const button = this.page
      .getByRole("button", { name: new RegExp(buttonText, "i") })
      .and(this.page.locator(":not([data-nextjs-dev-tools-button])"));

    await button.first().click();
  },
);

Then("I should see a success message", async function (this: CustomWorld) {
  const successMessage = this.page.locator(
    '[role="status"], .success, .toast, [class*="success"]',
  );
  await expect(successMessage).toBeVisible({ timeout: 10000 });
});

Then(
  "I should be redirected to {string}",
  async function (this: CustomWorld, url: string) {
    await this.page.waitForURL(new RegExp(url), { timeout: 10000 });
    await expect(this.page).toHaveURL(new RegExp(url));
  },
);
```

### World Configuration

The E2E world is configured in `e2e/support/world.ts`:

```typescript
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  baseUrl: string;

  constructor(options: IWorldOptions) {
    super(options);
    this.baseUrl = process.env.BASE_URL || "http://localhost:3000";
  }

  async init() {
    this.browser = await chromium.launch({
      headless: process.env.CI === "true",
    });

    const extraHTTPHeaders: Record<string, string> = {};
    const e2eBypassSecret = process.env.E2E_BYPASS_SECRET;
    if (e2eBypassSecret) {
      extraHTTPHeaders["x-e2e-auth-bypass"] = e2eBypassSecret;
    }

    this.context = await this.browser.newContext({
      baseURL: this.baseUrl,
      extraHTTPHeaders,
    });
    this.page = await this.context.newPage();
  }

  async destroy() {
    await this.page?.close();
    await this.context?.close();
    await this.browser?.close();
  }
}
```

---

## Coverage Requirements

Coverage thresholds are enforced in CI and configured in `vitest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 30%       |
| Functions  | 20%       |
| Branches   | 25%       |
| Statements | 30%       |

**Note:** These are current enforced baselines. The target remains to increase
these thresholds over time.

### Excluded from Coverage

The following are excluded from coverage calculations:

| Pattern                          | Reason                                   |
| -------------------------------- | ---------------------------------------- |
| `src/**/*.d.ts`                  | Type definitions only                    |
| `src/**/vitest.config.ts`        | Config files                             |
| `src/**/next.config.ts`          | Config files                             |
| `src/**/*.stories.tsx`           | Storybook stories                        |
| `src/**/index.ts`                | Barrel export files                      |
| `src/types/**/*.ts`              | Type definition files                    |
| `src/app/apps/**/*.tsx`          | Apps pages - presentational UI           |
| `src/components/apps/**/*.tsx`   | Apps components - presentational UI      |
| `src/workflows/**/*.workflow.ts` | Temporal workflows (require SDK testing) |
| `src/**/*.example.tsx`           | Example files                            |

### Coverage Reports

Coverage reports are generated in multiple formats:

- `text` - Console output
- `json` - Machine-readable JSON
- `html` - Interactive HTML report in `coverage/`
- `lcov` - For CI integrations

---

## Test Commands

### Unit Tests

```bash
# Run all unit tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test src/lib/utils.test.ts

# Run tests matching a pattern
yarn test --grep "cn utility"
```

### E2E Tests

```bash
# Run E2E tests locally (requires dev server running)
yarn test:e2e:local

# Run specific feature file
yarn cucumber e2e/features/landing-page.feature

# Run tests with specific tag
yarn cucumber --tags "@fast"

# Run tests excluding tags
yarn cucumber --tags "not @skip and not @flaky"

# Run with specific profile
yarn cucumber --profile ci
```

### CI Commands

```bash
# Full CI test suite (used in GitHub Actions)
yarn test:coverage
yarn build
yarn test:e2e:ci
```

---

## File Naming Conventions

### Test File Naming

| Convention | Example                   |
| ---------- | ------------------------- |
| Extension  | `.test.ts` or `.test.tsx` |
| Location   | Same directory as source  |
| Pattern    | `ComponentName.test.tsx`  |

**Important**: Use `.test.ts(x)`, NOT `.spec.ts(x)`.

### Directory Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── button.test.tsx
│   │   ├── input.tsx
│   │   └── input.test.tsx
│   └── enhance/
│       ├── ShareButton.tsx
│       └── ShareButton.test.tsx
├── hooks/
│   ├── useTokenBalance.ts
│   └── useTokenBalance.test.ts
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
└── app/
    └── api/
        └── health/
            ├── route.ts
            └── route.test.ts

e2e/
├── features/
│   ├── landing-page.feature
│   ├── authentication.feature
│   └── admin-dashboard.feature
├── step-definitions/
│   ├── common.steps.ts
│   ├── authentication.steps.ts
│   └── admin.steps.ts
└── support/
    ├── world.ts
    └── helpers/
        └── coverage-helper.ts
```

---

## Writing Tests

### Unit Test Patterns

#### Arrange-Act-Assert

```typescript
describe("UserService", () => {
  it("should create a new user", async () => {
    // Arrange
    const userData = { email: "test@example.com", name: "Test User" };
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "123",
      ...userData,
    });

    // Act
    const result = await createUser(userData);

    // Assert
    expect(result.id).toBe("123");
    expect(result.email).toBe("test@example.com");
  });
});
```

#### Testing React Components

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole("button", { name: /click me/i }));

    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

#### Testing Custom Hooks

```typescript
import { act, renderHook } from "@testing-library/react";

describe("useCounter", () => {
  it("increments count", () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

### E2E Test Patterns

#### API Mocking in E2E

```typescript
Given(
  "I have {int} tokens",
  async function (this: CustomWorld, tokenCount: number) {
    await this.page.route("**/api/tokens/balance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ balance: tokenCount }),
      });
    });
  },
);
```

#### Waiting for Elements

```typescript
Then("I should see the success message", async function (this: CustomWorld) {
  const message = this.page.getByText(/success/i);
  await expect(message).toBeVisible({ timeout: 10000 });
});
```

#### Testing Navigation

```typescript
When(
  "I click the {string} link",
  async function (this: CustomWorld, linkText: string) {
    const link = this.page.getByRole("link", {
      name: new RegExp(linkText, "i"),
    });
    const currentUrl = this.page.url();

    await link.first().click();

    await this.page.waitForFunction(
      (oldUrl) => window.location.href !== oldUrl,
      currentUrl,
      { timeout: 10000 },
    );
    await this.page.waitForLoadState("networkidle");
  },
);
```

---

## Best Practices

### DO

- **Test alongside implementation**: Write tests as you develop features
- **Use descriptive names**: Test names should describe the behavior being
  tested
- **Mock external dependencies**: Keep tests isolated and fast
- **Use data-testid sparingly**: Prefer role-based queries when possible
- **Test edge cases**: Empty states, error conditions, boundary values
- **Keep tests focused**: One assertion concept per test
- **Follow AAA pattern**: Arrange, Act, Assert

### DON'T

- **Don't test implementation details**: Test behavior, not internal state
- **Don't rely on test order**: Each test should be independent
- **Don't use `.spec.ts`**: Use `.test.ts` for consistency
- **Don't skip without documenting**: Add a TODO comment explaining why
- **Don't test external libraries**: They have their own tests
- **Don't use hardcoded timeouts**: Use Playwright's auto-waiting

### Query Priority (React Testing Library)

Prefer queries in this order:

1. `getByRole` - Most accessible and reliable
2. `getByLabelText` - Good for form inputs
3. `getByPlaceholderText` - Inputs with placeholders
4. `getByText` - Visible text content
5. `getByTestId` - Last resort for untestable elements

---

## Troubleshooting

### Coverage Not Meeting Thresholds

1. Run `yarn test:coverage` to see detailed report
2. Check `coverage/index.html` for line-by-line analysis
3. Look for uncovered branches (if/else, try/catch)
4. Ensure error cases are tested

### E2E Tests Failing

1. Ensure dev server is running: `yarn dev`
2. Check if BASE_URL is correct in environment
3. Install browser: `yarn dlx playwright install chromium`
4. Check for selector changes in the UI
5. Review step definition implementations

### Flaky Tests

1. Avoid hardcoded timeouts
2. Use proper wait strategies:
   ```typescript
   await expect(element).toBeVisible({ timeout: 10000 });
   await page.waitForLoadState("networkidle");
   ```
3. Ensure test isolation (no shared state)
4. Check for race conditions in async code

### Tests Timing Out

1. Increase timeout in configuration:
   ```javascript
   // cucumber.js
   timeout: 30000, // 30 seconds
   ```
2. Check for infinite loops or blocking operations
3. Verify API mocks are returning responses

### Module Resolution Issues

1. Check path aliases in `vitest.config.ts`
2. Verify mocked modules are in the correct location
3. Clear Vitest cache: `yarn test --clearCache`

---

## Related Documentation

- [E2E Test Implementation](./E2E_TEST_IMPLEMENTATION.md) - Detailed E2E setup
- [Testing Strategies Best Practices](./best-practices/testing-strategies.md) -
  General testing best practices
- [Manual Testing Guide](./MANUAL_TESTING_GUIDE.md) - Manual testing procedures

---

**Last Updated**: February 2026
