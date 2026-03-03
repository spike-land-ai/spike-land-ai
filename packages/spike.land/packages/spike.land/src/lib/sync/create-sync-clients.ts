import { GitHubProjectsClient } from "./clients/github-projects-client";

export function createGitHubProjectsClient(): GitHubProjectsClient {
  return new GitHubProjectsClient();
}
