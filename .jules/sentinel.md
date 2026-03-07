## 2025-05-22 - [XSS Prevention in Markdown Link Rendering]
**Vulnerability:** XSS through unsanitized markdown links `[text](url)` in AI chat messages and documentation content.
**Learning:** Both `AiChatMessage.tsx` and `$slug.tsx` implemented custom markdown-to-React/HTML logic without protocol-level URL sanitization. `AiChatMessage.tsx` used React props (safer), while `$slug.tsx` used `dangerouslySetInnerHTML` with manual string replacement.
**Prevention:** Always use a centralized URL sanitization utility like `src/frontend/platform-frontend/core-logic/lib/security.ts` to block `javascript:`, `data:`, and protocol-relative `//` URLs. Escape link text before embedding in raw HTML strings.
