export interface ComponentSpec {
  name: string;
  type: "page" | "component" | "hook" | "service" | "api" | "util";
  description: string;
  filePath: string;
  dependencies: string[]; // names of other components
}

export interface ArchitectureDesign {
  id: string;
  feature: string;
  components: ComponentSpec[];
  patterns: string[];
  riskAssessment: string[];
  createdAt: string;
}

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; type: "import" | "call" }>;
}

export interface FilePlanTask {
  id: string;
  path: string;
  action: "create" | "modify" | "delete";
  description: string;
  dependencies: string[]; // task IDs
}
