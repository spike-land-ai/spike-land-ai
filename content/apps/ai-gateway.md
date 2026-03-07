---
slug: "ai-gateway"
name: "AI Gateway"
description: "Chat with multiple AI models through a unified proxy. List available providers and models, then test a conversation."
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

The AI Gateway provides a unified interface to multiple LLM providers. Instead of integrating with OpenAI, Anthropic, and Gemini separately, you can use one tool.

## 1. List Providers

Discover which AI providers are currently configured and active in the gateway.

<ToolRun name="ai_list_providers" />

## 2. List Models

For a given provider, fetch the list of available models.

<ToolRun name="ai_list_models" />

## 3. Chat

Send a message to your chosen model and provider.

<ToolRun name="ai_chat" />
