# App Store Security

## Summary

The spike.land app store is intentionally open, but the runtime is not
permissionless. Public discovery, authenticated execution, publication-state
gates, and bounded sandbox behavior work together to keep the platform usable
without turning the shared MCP surface into arbitrary code execution.

---

## Threat Model

The app store has to handle five classes of risk:

1. anonymous discovery abuse
2. unauthorized tool execution
3. publication of unsafe or misleading apps
4. cross-app or cross-workspace data leakage
5. arbitrary code execution inside shared infrastructure

The current codebase already addresses parts of each class.

---

## Code-Backed Controls

### 1. Anonymous Access Is Narrow

The MCP auth middleware only permits a small anonymous allowlist:

- `search_tools`
- `list_categories`
- `get_status`
- `get_tool_info`

Everything else requires a bearer token.

### 2. Authenticated Runtime Uses Explicit Token Types

The MCP worker accepts:

- API keys with `sk_` prefix
- OAuth access tokens with `mcp_` prefix

That gives the platform a clean boundary between public metadata and private or
state-changing calls.

### 3. Publication State Gates Exist

The store does not publish everything by default.

Current schema-backed gates:

- `mcp_apps.status` defaults to `draft`
- public app listings only expose `live` apps
- `registered_tools.status` defaults to `draft`
- marketplace-style tool records move to `published` before public use

This matters because the store can separate submission from visibility.

### 4. The Shared Worker Does Not Spawn Real Processes

The sandbox tools in the shared MCP worker are explicitly simulated.

Important properties:

- in-memory storage only
- no process spawning
- Worker-friendly file limits
- clear warning that real execution belongs on the dedicated platform path, not
  the shared edge runtime

This is a real security feature, not a missing capability. It prevents the
shared Worker from becoming a multi-tenant shell host.

### 5. Public Metadata And Runtime Are Separate

The platform exposes public catalog data, but execution still goes through the
authenticated MCP path.

That means:

- apps can be discovered openly
- tools can be rendered into external UIs
- execution privileges are still checked at call time

---

## Open Submission Model

The store’s submission posture should be understood as:

`open to submit, gated to publish`

Operationally, the intended review sequence is:

1. metadata and schema validation
2. automated runtime and category checks
3. security and policy review
4. human spot-check where needed
5. status promotion to public visibility

The code already supports the state-transition side of this. The review process
is the operational layer that decides what gets promoted.

---

## Data Isolation Expectations

The store should not be thought of as “apps all sharing one giant memory
space.”

Safer mental model:

- apps expose specific MCP tools
- tools run with authenticated user context
- workspace and secret boundaries are enforced at the tool/runtime layer
- publication in the store does not grant ambient access to another app’s data

In other words, installability is not equivalent to unrestricted privilege.

---

## Cross-Origin Security

`mcp.spike.land` is intentionally CORS-open for the MCP worker. That does not
remove the auth boundary.

Important distinction:

- public metadata endpoints are readable cross-origin
- authenticated MCP calls still require bearer credentials
- auth/session infrastructure is not the same as the public MCP surface

This design allows an open platform without making private operations public.

---

## Sandboxing Guidance For App Authors

If you are publishing to the app store:

- do not assume you can run arbitrary native code inside the shared Worker
- prefer declarative tool composition and bounded remote calls
- use dedicated Worker deployments for isolation-sensitive workloads
- treat the shared sandbox tools as prototyping utilities, not production
  compute sandboxes

This is the correct division of responsibility for an open app store on shared
edge infrastructure.

---

## Monitoring And Abuse Controls

The platform also reduces risk through operations and observability:

- runtime rate limiting
- tool analytics and call tracking
- experiment anomaly monitoring
- explicit error classification and retryability

This matters because open platforms fail operationally long before they fail
cryptographically.

---

## Practical Trust Levels

### Public

- tool metadata
- app metadata
- well-known OAuth discovery docs

### Authenticated

- installs
- ratings and reviews
- workspace-scoped calls
- any non-anonymous MCP execution

### Published

- apps promoted from draft to live
- tools promoted from draft to published

### Isolated

- dedicated Worker deployments
- local offline bundles
- workspace and secret-scoped operations

This layered trust model is what makes an open app store defensible.
