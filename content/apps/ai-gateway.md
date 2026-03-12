---
slug: "ai-gateway"
name: "AI Gateway"
description: "OpenAI-compatible chat surface for spike.land. Keep the /v1 contract, add local docs and MCP capability context, then route to the right provider."
emoji: "🧠"
status: "live"
sort_order: 2
tools:
  - "ai_list_providers"
  - "ai_list_models"
  - "ai_chat"
graph:
  ai_list_providers:
    inputs: {}
    outputs:
      provider_id: "string"
    always_available: true
  ai_list_models:
    inputs:
      provider: "from:ai_list_providers.provider_id"
    outputs:
      model_id: "string"
    always_available: false
  ai_chat:
    inputs:
      provider: "from:ai_list_providers.provider_id"
      model: "from:ai_list_models.model_id"
    outputs: {}
    always_available: true
---

# AI Gateway

AI Gateway is now two things at once:

- a tool surface for provider discovery and direct chat
- an OpenAI-compatible HTTP endpoint that lets existing clients talk to spike.land without learning a new request format

If you want the HTTP surface specifically, open the dedicated playground at
[/packages/ai-gateway/ui](/packages/ai-gateway/ui). That route explains the endpoint, shows the live request shapes, and lets you try the local worker directly.

## OpenAI-Compatible Surface

The compatibility layer currently exposes:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `GET /api/v1/models`
- `POST /api/v1/chat/completions`

The `spike-agent-v1` model selector is virtual. The route first assembles local context from internal docs and MCP tool metadata, then resolves the actual synthesis provider with BYOK-first fallback logic.

### Try it locally

```bash
bash scripts/dev-local.sh
# then open:
http://local.spike.land:5173/packages/ai-gateway/ui
```

### Direct local curl

```bash
curl -sS https://local.spike.land:8787/v1/models \
  -H 'Authorization: Bearer <INTERNAL_SERVICE_SECRET>' \
  -H 'X-User-Id: local-dev-user'
```

## MCP Tool Surface

The MCP side still provides a unified interface to multiple LLM providers. Instead of integrating with OpenAI, Anthropic, and Gemini separately, you can use one tool family.

## 1. List Providers

Discover which AI providers are currently configured and active in the gateway.

<ToolRun name="ai_list_providers" />

## 2. List Models

For a given provider, fetch the list of available models.

<ToolRun name="ai_list_models" />

## 3. Chat

Send a message to your chosen model and provider.

<ToolRun name="ai_chat" />
