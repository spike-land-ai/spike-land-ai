import { Suspense } from "react";
import { PhysicsBackground } from "./PhysicsBackground";

export default function PhysicsBackgroundDynamic(props: { disabled?: boolean }) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-zinc-950 z-[-1] pointer-events-none" />}>
      <PhysicsBackground {...props} />
    </Suspense>
  );
}
