# CLAUDE.md

## Overview

MCP server for WhatsApp Business Cloud API. Node.js runtime,
published as `@spike-land-ai/whatsapp-mcp`.

## Commands

```bash
npm run build        # Compile TypeScript (tsc)
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm start            # Run the MCP server
```

## Architecture

```
├── index.ts           # MCP server entry point
├── types.ts           # Shared types and API constants
├── clients/           # WhatsApp Cloud API client
│   └── whatsapp-client.ts
└── tools/             # MCP tool implementations
    ├── send-message.ts    # whatsapp_send_message
    ├── send-template.ts   # whatsapp_send_template
    ├── list-templates.ts  # whatsapp_list_templates
    └── mark-read.ts       # whatsapp_mark_read
```

## Environment Variables

| Variable                    | Required | Purpose                        |
| --------------------------- | -------- | ------------------------------ |
| `WHATSAPP_ACCESS_TOKEN`     | Yes      | Meta Graph API access token    |
| `WHATSAPP_PHONE_NUMBER_ID`  | Yes      | WhatsApp Business phone number |

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage
