/**
 * Jules API Types
 *
 * TypeScript types for the Google Jules async coding agent API.
 * @see https://developers.google.com/jules/api
 */

// Session state values from Jules API
type JulesSessionState =
  | "QUEUED"
  | "PLANNING"
  | "AWAITING_PLAN_APPROVAL"
  | "AWAITING_USER_FEEDBACK"
  | "IN_PROGRESS"
  | "PAUSED"
  | "FAILED"
  | "COMPLETED";

// Automation modes for session creation
type JulesAutomationMode = "AUTO_CREATE_PR";

// Source context for GitHub repositories
interface JulesGithubRepoContext {
  startingBranch?: string;
}

interface JulesSourceContext {
  source: string; // e.g., "sources/github/owner/repo"
  githubRepoContext?: JulesGithubRepoContext;
}

// Session output (e.g., pull requests)
interface JulesSessionOutput {
  url?: string;
  title?: string;
  description?: string;
}

// Jules Session resource
export interface JulesSession {
  name: string; // Resource name, e.g., "sessions/abc123"
  id?: string;
  state: JulesSessionState;
  createTime?: string;
  updateTime?: string;
  url?: string; // Link to Jules web interface
  title?: string;
  outputs?: JulesSessionOutput[];
  planSummary?: string;
}

// Activity within a session
export interface JulesActivity {
  name: string; // Resource name
  type?: string;
  content?: string;
  createTime?: string;
}

// Source resource
export interface JulesSource {
  name: string; // e.g., "sources/github/owner/repo"
  displayName?: string;
}

// Request/Response types

export interface CreateSessionRequest {
  prompt: string;
  sourceContext: JulesSourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: JulesAutomationMode;
}

export interface ListSessionsResponse {
  sessions: JulesSession[];
  nextPageToken?: string;
}

export interface ListActivitiesResponse {
  activities: JulesActivity[];
  nextPageToken?: string;
}

export interface ListSourcesResponse {
  sources: JulesSource[];
  nextPageToken?: string;
}

// Error response from Jules API
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
