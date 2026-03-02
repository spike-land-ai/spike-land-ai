"use client";

import dynamic from "next/dynamic";

const PhysicsBackground = dynamic(
  () => import("@/components/landing/PhysicsBackground").then((m) => m.PhysicsBackground),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 pointer-events-none -z-10 bg-zinc-950" />,
  },
);

export function PhysicsBackgroundDynamic({ disabled }: { disabled: boolean }) {
  return <PhysicsBackground disabled={disabled} />;
}
