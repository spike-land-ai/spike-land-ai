import { BAZDMEG_SYSTEM_PROMPT } from "@/lib/bazdmeg/system-prompt";

export interface ChatConfig {
  systemPrompt: string;
  chatTitle: string;
  placeholder: string;
  allowTools: boolean;
}

const CREATE_ASSISTANT_PROMPT =
  `You are the spike.land Code Assistant — a helpful AI embedded in the /create app builder.

You help users understand, debug, and improve their apps built on the spike.land platform.

Your capabilities:
- Explain how an app's code works
- Suggest improvements or bug fixes
- Help with React, TypeScript, Tailwind CSS, and web APIs
- Answer questions about the spike.land platform and codespace system

Keep answers concise and code-focused. When suggesting code changes, show the minimal diff needed. Use markdown for formatting.`;

const GENERAL_ASSISTANT_PROMPT =
  `You are the spike.land assistant — a helpful AI that answers questions about the spike.land platform.

spike.land is an open-source AI-powered development platform. It features:
- A real-time collaborative code editor (codespaces)
- An app store with skills and tools
- AI agent integration for development workflows
- The BAZDMEG methodology for disciplined AI-assisted development

You help users navigate the platform, understand features, and get started with building.

Keep answers concise and helpful. If someone asks something unrelated to spike.land, briefly redirect them.`;

export function getChatConfig(
  pathname: string,
  isLoggedIn: boolean,
): ChatConfig {
  if (pathname.startsWith("/bazdmeg")) {
    return {
      systemPrompt: BAZDMEG_SYSTEM_PROMPT,
      chatTitle: "BAZDMEG Assistant",
      placeholder: "Ask about the BAZDMEG method...",
      allowTools: false,
    };
  }

  if (pathname.startsWith("/create")) {
    return {
      systemPrompt: CREATE_ASSISTANT_PROMPT,
      chatTitle: "Code Assistant",
      placeholder: "Ask about this app's code...",
      allowTools: isLoggedIn,
    };
  }

  return {
    systemPrompt: GENERAL_ASSISTANT_PROMPT,
    chatTitle: "Ask spike.land",
    placeholder: "Ask about spike.land...",
    allowTools: false,
  };
}
