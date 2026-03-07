export type AgentRole =
  | "MCP_Explorer_A"
  | "MCP_Explorer_B"
  | "Website_Explorer_A"
  | "Website_Explorer_B"
  | "QA_Expert_A"
  | "QA_Expert_B"
  | "Log_Monitor_A"
  | "Log_Monitor_B";

export interface Persona {
  id: number;
  name: string;
  archetype: string;
  level: string;
  focus: string;
  scenarios: string[];
}

export const PERSONAS: Record<number, Persona> = {
  // MCP-focused
  1: { id: 1, name: "Alex Chen", archetype: "Solo indie dev", level: "Advanced", focus: "Tool chaining, error propagation, timeouts", scenarios: ["Chain bazdmeg_enter_workspace → bazdmeg_get_context → bazdmeg_run_gates. Verify context bundle contains CLAUDE.md.", "Trigger a timeout on bazdmeg_run_gates with a large workspace and verify error recovery"] },
  2: { id: 2, name: "Priya Sharma", archetype: "Enterprise architect", level: "Expert", focus: "Auth flows, rate limiting, concurrent connections", scenarios: ["Test auth with malformed tokens", "Hit rate limits concurrently"] },
  3: { id: 3, name: "Marcus Johnson", archetype: "Junior dev", level: "Beginner", focus: "Onboarding, error clarity", scenarios: ["Provide invalid params to tools", "Ensure error messages are actionable"] },
  4: { id: 4, name: "Sofia Rodriguez", archetype: "QA automation", level: "Advanced", focus: "Edge cases, empty inputs, malformed schemas", scenarios: ["Send empty strings to required fields", "Exceed payload size limits"] },
  5: { id: 5, name: "Yuki Tanaka", archetype: "Data scientist", level: "Intermediate", focus: "Large result sets, pagination, memory", scenarios: ["Fetch max limits", "Test pagination end boundaries"] },
  6: { id: 6, name: "Ahmed Hassan", archetype: "Security researcher", level: "Expert", focus: "Injection, auth bypass, rate limit circumvention", scenarios: ["Send `'; DROP TABLE--` as title in bazdmeg_fixer_report_finding. Verify Zod rejects or D1 parameterized query handles safely.", "Attempt path traversal (../../etc/passwd) in bazdmeg_enter_workspace package parameter"] },
  7: { id: 7, name: "Emma Wilson", archetype: "DevOps/SRE", level: "Advanced", focus: "Health endpoints, graceful degradation", scenarios: ["Test fallback logic when bindings fail", "Poll health endpoints"] },
  8: { id: 8, name: "Carlos Mendez", archetype: "Mobile developer", level: "Intermediate", focus: "Latency-sensitive paths, partial responses", scenarios: ["Simulate high latency responses", "Test partial data parsing"] },

  // Website-focused
  9: { id: 9, name: "Lisa Park", archetype: "Product manager", level: "Non-technical", focus: "Navigation, error recovery, empty states", scenarios: ["Use web_navigate to load /bugbook, then web_click on the first bug link. Verify bug detail page renders.", "Navigate to /nonexistent-page and verify 404 page shows helpful message with navigation back"] },
  10: { id: 10, name: "David Brown", archetype: "Accessibility auditor", level: "Expert", focus: "ARIA labels, keyboard nav, focus management", scenarios: ["Tab through all forms", "Ensure focus returns on modal close"] },
  11: { id: 11, name: "Anya Ivanova", archetype: "Impatient power user", level: "Advanced", focus: "Race conditions, stale state, back-button", scenarios: ["Rapid click submit", "Use browser back immediately after action"] },
  12: { id: 12, name: "Tom O'Brien", archetype: "Slow network, old device", level: "Basic", focus: "Loading states, layout shifts", scenarios: ["Verify skeletons on slow load", "Test image layout shifts"] },
  13: { id: 13, name: "Mei-Lin Wu", archetype: "International user", level: "Intermediate", focus: "CJK input, Unicode edge cases", scenarios: ["Input CJK chars in forms", "Test RTL language display if supported"] },
  14: { id: 14, name: "James Cooper", archetype: "First-time visitor", level: "Beginner", focus: "Landing page, CTA clarity, signup flow", scenarios: ["Complete signup flow", "Verify email validation UX"] },
  15: { id: 15, name: "Rachel Kim", archetype: "Content creator", level: "Intermediate", focus: "Monaco editor, live preview, auto-save", scenarios: ["Use web_navigate to load /live/code-editor, type rapidly in Monaco editor, verify no lag or lost keystrokes", "Paste a 500-line TypeScript file into Monaco and verify syntax highlighting completes within 2 seconds"] },
  16: { id: 16, name: "Oleg Petrov", archetype: "Admin/power user", level: "Expert", focus: "Admin routes, bulk ops, destructive actions", scenarios: ["Attempt bulk delete", "Verify confirmation dialogs on destructive ops"] },
};

export const QUIZ_BANK = {
  "1_setup": [
    { question: "What command verifies Docker services are running?", options: ["make docker-ps", "docker run", "npm start", "make run"], correctIndex: 0 },
    { question: "How do you test local HTTPS access?", options: ["Visit http://localhost:3000", "Visit https://local.spike.land", "curl google.com", "Ping local.spike.land"], correctIndex: 1 },
    { question: "How is live reload confirmed?", options: ["Restarting the server", "Modifying a file and observing the change", "Checking the logs", "Running tests"], correctIndex: 1 }
  ],
  "2_explore": [
    { question: "Where are findings logged?", options: ["A text file", "Bugbook via bazdmeg_fixer_report_finding", "GitHub issues", "Slack"], correctIndex: 1 },
    { question: "Are agents running sequentially or concurrently?", options: ["Concurrently", "Sequentially", "Randomly", "In pairs"], correctIndex: 0 },
    { question: "What must be passed before starting exploration?", options: ["A unit test", "A persona quiz", "Code review", "Docker build"], correctIndex: 1 }
  ],
  "3_triage": [
    { question: "What tool do QA Experts use to reproduce bugs?", options: ["grep", "qa-studio", "docker", "postman"], correctIndex: 1 },
    { question: "What happens to confirmed bugs?", options: ["Confirmed via POST /bugbook/:id/confirm, bumping report count and ELO", "Deleted", "Assigned immediately", "Closed as won't fix"], correctIndex: 0 },
    { question: "What is the role of Log Monitors?", options: ["Fixing bugs", "Correlating errors with bugs", "Writing tests", "Updating docs"], correctIndex: 1 }
  ],
  "4_fix": [
    { question: "How many independent validators must pass a fix?", options: ["1", "2", "3", "4"], correctIndex: 1 },
    { question: "What happens when both validators pass?", options: ["Manual review", "bazdmeg_auto_ship commits and pushes", "Issue is closed", "Email sent"], correctIndex: 1 },
    { question: "What is the max iterations per fix?", options: ["1", "2", "3", "Unlimited"], correctIndex: 2 }
  ],
  "5_regression": [
    { question: "What is compared in Stage 5?", options: ["New logs with old logs", "Re-run of 16 scenarios vs Stage 2 baseline", "Code coverage", "Performance metrics"], correctIndex: 1 },
    { question: "Where do new bugs found in Stage 5 go?", options: ["Stage 3", "Stage 1", "Closed", "Stage 4"], correctIndex: 0 },
    { question: "What is the final output?", options: ["A commit", "A final report", "A new branch", "A pull request"], correctIndex: 1 }
  ]
};

export interface AgentAssignment {
  agentId: string;
  role: AgentRole;
  personas: number[];
}

export interface FixerSession {
  id: string;
  stage: string;
  target: string;
  baseUrl: string;
  config: Record<string, unknown>;
  createdAt: number;
}

export function createFixerSessionId(): string {
  return `fixer_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
