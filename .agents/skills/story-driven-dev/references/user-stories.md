# User Story Guide

## Format

```
As a [role], I want [action], so that [benefit].

Acceptance Criteria:
- Given [context], when [action], then [expected result]
- Given [context], when [action], then [expected result]
```

## Story-to-Tool Mapping

Each user story maps to one MCP tool. The mapping follows a naming convention:

| Story                          | Tool Name             | Category      |
| ------------------------------ | --------------------- | ------------- |
| "User can update their email"  | `update_user_email`   | user-settings |
| "User can cancel subscription" | `cancel_subscription` | billing       |
| "Admin can ban a user"         | `ban_user`            | admin         |
| "User can list their secrets"  | `vault_list_secrets`  | vault         |

**Naming rules:**

- `verb_noun` format, snake_case
- Verb = the action from the user story (update, create, delete, list, cancel,
  approve)
- Noun = the entity being acted on
- Category = the domain grouping (becomes the MCP tool category)

## Acceptance Criteria become Test Cases

Each acceptance criterion becomes a unit test:

```
Story: As a user, I want to store a secret, so that agents can use it securely.

Acceptance Criteria:
- Given a valid name and value, when I store a secret, then it is encrypted and saved
  → test: "should store an encrypted secret"

- Given I've reached my quota, when I store a secret, then I get an error
  → test: "should enforce quota for free tier"

- Given I have a premium subscription, when I store a secret, then the quota is higher
  → test: "should allow more secrets for premium users"

- Given the database is unavailable, when I store a secret, then I get an error message
  → test: "should handle database errors"
```

## Grouping Stories into Categories

Stories that share a domain become a category. Each category gets:

1. A registration function: `registerMyTools(registry, userId)`
2. An entry in `CATEGORY_DESCRIPTIONS` in `tool-registry.ts`
3. A line in `mcp-server.ts` calling the registration function

Example grouping:

```
vault (4 tools):
  - vault_store_secret
  - vault_list_secrets
  - vault_delete_secret
  - vault_approve_secret
```

## Writing Good Stories

**Good:** "As a workspace owner, I want to revoke a secret, so that compromised
credentials can't be used."

- Clear role, clear action, clear benefit
- Maps directly to `vault_delete_secret`
- Acceptance criteria are testable

**Bad:** "The system should handle secrets properly."

- No role, vague action, no benefit
- Can't map to a specific tool
- Can't derive test cases
