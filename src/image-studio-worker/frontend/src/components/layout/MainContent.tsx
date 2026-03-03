import type { Workspace } from "./Sidebar";
import { Canvas } from "../studio/Canvas";
import { Library } from "../sections/Library";
import { Pipelines } from "../sections/Pipelines";
import { LiveActivity } from "../sections/LiveActivity";
import { Settings } from "../sections/Settings";

interface MainContentProps {
  workspace: Workspace;
}

const WORKSPACE_COMPONENTS: Record<Workspace, React.ComponentType> = {
  studio: Canvas,
  archive: Library,
  intelligence: Pipelines,
  showcase: LiveActivity,
  settings: Settings,
};

export function MainContent({ workspace }: MainContentProps) {
  const Component = WORKSPACE_COMPONENTS[workspace];

  return (
    <main className="flex-1 overflow-y-auto relative">
      <Component />
    </main>
  );
}
