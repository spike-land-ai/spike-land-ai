import type { ArchitectureDesign, DependencyGraph, FilePlanTask } from "./types";

export function decomposeFeature(feature: string, _repoFiles: string[]): ArchitectureDesign {
  // Simple heuristic-based decomposition
  const id = Math.random().toString(36).substring(2, 11);
  const design: ArchitectureDesign = {
    id,
    feature,
    components: [],
    patterns: ["Next.js App Router", "Tailwind CSS"],
    riskAssessment: ["High complexity in state management likely"],
    createdAt: new Date().toISOString(),
  };

  if (feature.toLowerCase().includes("page")) {
    design.components.push({
      name: "MainPage",
      type: "page",
      description: `Primary entry point for ${feature}`,
      filePath: "src/app/feature/page.tsx",
      dependencies: [],
    });
  }

  return design;
}

export function buildDependencyGraph(
  files: Array<{ path: string; imports: string[] }>,
): DependencyGraph {
  const nodes = files.map((f) => ({
    id: f.path,
    label: f.path.split("/").pop() || f.path,
    type: "file",
  }));
  const edges = files.flatMap((f) =>
    f.imports.map((imp) => ({
      from: f.path,
      to: imp,
      type: "import" as const,
    })),
  );

  return { nodes, edges };
}

export function createFilePlan(design: ArchitectureDesign): FilePlanTask[] {
  return design.components.map((comp, idx) => ({
    id: `task-${idx + 1}`,
    path: comp.filePath,
    action: "create",
    description: `Implement ${comp.type} component: ${comp.name}`,
    dependencies: [],
  }));
}
